import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFileContent } from '@/lib/github'
import { analyzeSkillContent } from '@/lib/analyze'
import type { ScanWithDetails } from '@/lib/types'

export const maxDuration = 30

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

    // Fetch all file contents from GitHub in parallel
    const fileResults = await Promise.all(
      files.map(async (filePath) => {
        const name = filePath.split('/').pop()?.replace(/\.md$/i, '') || filePath
        try {
          const content = await getFileContent(owner, repo, filePath)
          return { filePath, name, content, error: null }
        } catch (err) {
          return { filePath, name, content: null, error: err instanceof Error ? err.message : 'Failed to fetch file' }
        }
      })
    )

    // Create all skill records in one batch
    const skillInserts = fileResults.map(r => ({
      user_id: user.id,
      name: r.name,
      content: r.content || '',
      file_path: `github:${owner}/${repo}/${r.filePath}`,
    }))

    const { data: skills, error: skillsError } = await supabase
      .from('skills')
      .insert(skillInserts)
      .select()

    if (skillsError || !skills) {
      return NextResponse.json(
        { error: 'Failed to create skill records', details: skillsError?.message },
        { status: 500 }
      )
    }

    // Create all scan records in one batch
    const scanInserts = skills.map((skill, i) => ({
      skill_id: skill.id,
      status: fileResults[i].error ? 'failed' as const : 'scanning' as const,
      started_at: new Date().toISOString(),
      ...(fileResults[i].error ? {
        completed_at: new Date().toISOString(),
        error_message: fileResults[i].error,
      } : {}),
    }))

    const { data: scans, error: scansError } = await supabase
      .from('scans')
      .insert(scanInserts)
      .select()

    if (scansError || !scans) {
      return NextResponse.json(
        { error: 'Failed to create scan records', details: scansError?.message },
        { status: 500 }
      )
    }

    // Analyze and insert findings for files that were fetched successfully
    const analyzePromises = scans.map(async (scan, i) => {
      if (scan.status === 'failed') return

      const content = fileResults[i].content!
      const skill = skills[i]

      try {
        const findings = analyzeSkillContent(content, skill.id, scan.id)

        if (findings.length > 0) {
          const { error: findingsError } = await supabase
            .from('findings')
            .insert(findings)
          if (findingsError) throw findingsError
        }

        await supabase
          .from('scans')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', scan.id)
      } catch (error) {
        await supabase
          .from('scans')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Analysis error',
            completed_at: new Date().toISOString(),
          })
          .eq('id', scan.id)
      }
    })

    await Promise.all(analyzePromises)

    // Fetch all scans with details
    const { data: scansWithDetails } = await supabase
      .from('scans')
      .select(`
        *,
        skill:skills(*),
        findings:findings(*)
      `)
      .in('id', scans.map(s => s.id))
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
