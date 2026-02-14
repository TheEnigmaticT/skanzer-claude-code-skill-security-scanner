import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseGitHubUrl, getRepoDefaultBranch, getRepoTree } from '@/lib/github'

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
    const { url } = body as { url: string }

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'GitHub repository URL is required' },
        { status: 400 }
      )
    }

    const parsed = parseGitHubUrl(url.trim())
    if (!parsed) {
      return NextResponse.json(
        { error: 'Invalid GitHub URL. Expected format: https://github.com/owner/repo' },
        { status: 400 }
      )
    }

    const { owner, repo } = parsed

    let branch: string
    try {
      branch = await getRepoDefaultBranch(owner, repo)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to access repository'
      const status = message.includes('not found') ? 404 :
                     message.includes('rate limit') ? 429 : 500
      return NextResponse.json({ error: message }, { status })
    }

    let files
    try {
      files = await getRepoTree(owner, repo, branch)
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Failed to fetch file tree' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      files,
      repo: { owner, repo, branch }
    })
  } catch (error) {
    console.error('GitHub tree error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
