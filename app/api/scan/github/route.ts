import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getFilesContent, getRepoDefaultBranch } from '@/lib/github'
import { analyzeSkillContent } from '@/lib/analyze'
import type { ScanWithDetails } from '@/lib/types'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const admin = createServiceClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { owner, repo, branch, files } = body as {
      owner: string
      repo: string
      branch?: string
      files: string[]
    }

    if (!owner || !repo || !files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: 'owner, repo, and files array are required' },
        { status: 400 }
      )
    }

    if (files.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 files per request. Use smaller batches.' },
        { status: 400 }
      )
    }

    // Always resolve branch so raw.githubusercontent.com fetching works
    const resolvedBranch = branch || await getRepoDefaultBranch(owner, repo)

    // Fetch all file contents with concurrency control (10 at a time via raw.githubusercontent.com)
    const fileContents = await getFilesContent(owner, repo, files, resolvedBranch, 10)

    // Process each file: create skill, scan, analyze, insert findings
    const scanIds: string[] = []

    for (const filePath of files) {
      const result = fileContents.get(filePath)!
      const name = filePath.split('/').pop()?.replace(/\.md$/i, '') || filePath

      // Create skill record
      const { data: skill, error: skillError } = await admin
        .from('skills')
        .insert({
          user_id: user.id,
          name,
          content: result.content || '',
          file_path: `github:${owner}/${repo}/${filePath}`,
        })
        .select()
        .single()

      if (skillError || !skill) {
        console.error(`Failed to create skill for ${filePath}:`, skillError)
        continue
      }

      // If file fetch failed, create a failed scan
      if (result.error) {
        const { data: scan } = await admin
          .from('scans')
          .insert({
            skill_id: skill.id,
            status: 'failed',
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
            error_message: result.error,
          })
          .select()
          .single()
        if (scan) scanIds.push(scan.id)
        continue
      }

      // Create scan record
      const { data: scan, error: scanError } = await admin
        .from('scans')
        .insert({
          skill_id: skill.id,
          status: 'scanning',
          started_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (scanError || !scan) {
        console.error(`Failed to create scan for ${filePath}:`, scanError)
        continue
      }

      try {
        const findings = analyzeSkillContent(result.content!, skill.id, scan.id)

        if (findings.length > 0) {
          const { error: findingsError } = await admin
            .from('findings')
            .insert(findings)
          if (findingsError) throw findingsError
        }

        await admin
          .from('scans')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', scan.id)

        scanIds.push(scan.id)
      } catch (error) {
        await admin
          .from('scans')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Analysis error',
            completed_at: new Date().toISOString(),
          })
          .eq('id', scan.id)
        scanIds.push(scan.id)
      }
    }

    // Fetch all scans with details
    const { data: scansWithDetails } = await admin
      .from('scans')
      .select(`
        *,
        skill:skills(*),
        findings:findings(*)
      `)
      .in('id', scanIds)
      .order('started_at', { ascending: false })

    return NextResponse.json({
      scans: (scansWithDetails || []) as ScanWithDetails[],
    })
  } catch (error) {
    console.error('GitHub scan error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
