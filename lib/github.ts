const GITHUB_API = 'https://api.github.com'

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Skanzer',
  }
  const token = process.env.GITHUB_TOKEN
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

export interface ParsedRepo {
  owner: string
  repo: string
}

export interface RepoFile {
  path: string
  size: number
}

export function parseGitHubUrl(url: string): ParsedRepo | null {
  // Match: https://github.com/owner/repo[.git][/tree/branch/...][/blob/...]
  const match = url.match(
    /^https?:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:\/(?:tree|blob)\/.*)?(?:\/)?$/
  )
  if (!match) return null
  return { owner: match[1], repo: match[2] }
}

export async function getRepoDefaultBranch(owner: string, repo: string): Promise<string> {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, {
    headers: getHeaders(),
  })
  if (res.status === 404) {
    throw new Error('Repository not found')
  }
  if (res.status === 403 || res.status === 429) {
    throw new Error('GitHub API rate limit exceeded. Try again later or set GITHUB_TOKEN.')
  }
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status}`)
  }
  const data = await res.json()
  return data.default_branch
}

export async function getRepoTree(
  owner: string,
  repo: string,
  branch: string
): Promise<RepoFile[]> {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    { headers: getHeaders() }
  )
  if (!res.ok) {
    throw new Error(`Failed to fetch repository tree: ${res.status}`)
  }
  const data = await res.json()

  // Filter to .md blobs only
  return (data.tree || [])
    .filter((item: { type: string; path: string }) =>
      item.type === 'blob' && item.path.endsWith('.md')
    )
    .map((item: { path: string; size?: number }) => ({
      path: item.path,
      size: item.size || 0,
    }))
}

/**
 * Fetch file content via raw.githubusercontent.com (no API rate limit).
 * Falls back to the contents API if raw fetch fails.
 */
export async function getFileContent(
  owner: string,
  repo: string,
  path: string,
  branch?: string
): Promise<string> {
  // Try raw URL first — not rate-limited
  if (branch) {
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`
    const rawRes = await fetch(rawUrl, {
      headers: { 'User-Agent': 'Skanzer' },
    })
    if (rawRes.ok) {
      return rawRes.text()
    }
    // 404 means file doesn't exist at that path/branch — fall through to API
    if (rawRes.status !== 404) {
      throw new Error(`Failed to fetch ${path}: HTTP ${rawRes.status}`)
    }
  }

  // Fallback to contents API
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
    { headers: getHeaders() }
  )
  if (res.status === 403 || res.status === 429) {
    throw new Error(`GitHub API rate limit exceeded fetching ${path}. Set GITHUB_TOKEN for higher limits.`)
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch file ${path}: ${res.status}`)
  }
  const data = await res.json()
  if (data.encoding === 'base64' && data.content) {
    return Buffer.from(data.content, 'base64').toString('utf-8')
  }
  throw new Error(`Unexpected encoding for ${path}: ${data.encoding}`)
}

/**
 * Fetch multiple files with concurrency control to avoid overwhelming servers.
 */
export async function getFilesContent(
  owner: string,
  repo: string,
  paths: string[],
  branch?: string,
  concurrency = 10
): Promise<Map<string, { content: string | null; error: string | null }>> {
  const results = new Map<string, { content: string | null; error: string | null }>()
  const queue = [...paths]

  async function worker() {
    while (queue.length > 0) {
      const path = queue.shift()!
      try {
        const content = await getFileContent(owner, repo, path, branch)
        results.set(path, { content, error: null })
      } catch (err) {
        results.set(path, {
          content: null,
          error: err instanceof Error ? err.message : 'Failed to fetch file',
        })
      }
    }
  }

  // Spawn workers up to concurrency limit
  const workers = Array.from(
    { length: Math.min(concurrency, paths.length) },
    () => worker()
  )
  await Promise.all(workers)

  return results
}
