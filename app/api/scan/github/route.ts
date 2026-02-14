import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFileContent } from '@/lib/github'
import { analyzeSkillContent } from '@/lib/analyze'
import type { ScanWithDetails } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { owner, repo, files } = body as {
      owner: string
      repo: string
      files: string[]
    }

    if (!owner || !repo || !files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: 'owner, repo, and files array are required' },
        { status: 400 }
      )
    }

    const scanIds: string[] = []

    for (const filePath of files) {
      // Derive skill name from filename (sans .md)
      const name = filePath.split('/').pop()?.replace(/\.md$/i, '') || filePath

      let content: string
      try {
        content = await getFileContent(owner, repo, filePath)
      } catch (err) {
        // Create a failed skill/scan entry for this file
        const { data: skill } = await supabase
          .from('skills')
          .insert({
            user_id: user.id,
            name,
            content: '',
            file_path: `github:${owner}/${repo}/${filePath}`,
          })
          .select()
          .single()

        if (skill) {
          const { data: scan } = await supabase
            .from('scans')
            .insert({
              skill_id: skill.id,
              status: 'failed',
              started_at: new Date().toISOString(),
              completed_at: new Date().toISOString(),
              error_message: err instanceof Error ? err.message : 'Failed to fetch file',
            })
            .select()
            .single()
          if (scan) scanIds.push(scan.id)
        }
        continue
      }

      // Create skill record
      const { data: skill, error: skillError } = await supabase
        .from('skills')
        .insert({
          user_id: user.id,
          name,
          content,
          file_path: `github:${owner}/${repo}/${filePath}`,
        })
        .select()
        .single()

      if (skillError || !skill) {
        console.error(`Failed to create skill for ${filePath}:`, skillError)
        continue
      }

      // Create scan record
      const { data: scan, error: scanError } = await supabase
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
        // Analyze content
        const findings = analyzeSkillContent(content, skill.id, scan.id)

        // Insert findings
        if (findings.length > 0) {
          const { error: findingsError } = await supabase
            .from('findings')
            .insert(findings)

          if (findingsError) throw findingsError
        }

        // Mark completed
        await supabase
          .from('scans')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', scan.id)

        scanIds.push(scan.id)
      } catch (error) {
        // Mark failed
        await supabase
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
    const { data: scansWithDetails } = await supabase
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
