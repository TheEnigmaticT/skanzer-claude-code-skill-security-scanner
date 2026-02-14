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

export async function getFileContent(
  owner: string,
  repo: string,
  path: string
): Promise<string> {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
    { headers: getHeaders() }
  )
  if (!res.ok) {
    throw new Error(`Failed to fetch file ${path}: ${res.status}`)
  }
  const data = await res.json()
  if (data.encoding === 'base64' && data.content) {
    return Buffer.from(data.content, 'base64').toString('utf-8')
  }
  throw new Error(`Unexpected encoding for ${path}: ${data.encoding}`)
}
