import { NextRequest, NextResponse } from 'next/server'
import { getRepoSummary } from '@/lib/repo'
import { buildBadgeData, renderBadgeSvg } from '@/lib/badge'

/**
 * Public repo-level badge endpoint — no auth required.
 * GET /api/badge/repo/:owner/:repo
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  try {
    const { owner, repo } = await params
    const summary = await getRepoSummary(owner, repo)

    if (!summary) {
      const svg = renderNotFoundSvg()
      return new NextResponse(svg, {
        status: 404,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'no-cache',
        },
      })
    }

    const allFindings = summary.skills.flatMap(s => s.findings)
    const badgeData = buildBadgeData(
      `${owner}/${repo}`,
      allFindings,
      summary.lastScanDate || 'N/A'
    )

    const origin = request.nextUrl.origin
    const reportUrl = `${origin}/repo/${owner}/${repo}`
    const svg = renderBadgeSvg(badgeData, reportUrl)

    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    })
  } catch (error) {
    console.error('Repo badge error:', error)
    const svg = renderNotFoundSvg()
    return new NextResponse(svg, {
      status: 500,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'no-cache',
      },
    })
  }
}

function renderNotFoundSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="20" role="img">
  <clipPath id="r"><rect width="160" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="80" height="20" fill="#555"/>
    <rect x="80" width="80" height="20" fill="#9ca3af"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,sans-serif" font-size="11">
    <text x="40" y="14">\u{1F6E1}\uFE0F Skanzer</text>
    <text x="120" y="14">not found</text>
  </g>
</svg>`
}
