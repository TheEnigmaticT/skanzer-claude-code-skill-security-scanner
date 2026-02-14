import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { buildBadgeData, renderBadgeSvg } from '@/lib/badge'

/**
 * Public badge endpoint — no auth required so it works in GitHub READMEs.
 * GET /api/badge/:scanId
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const admin = createServiceClient()

    // Fetch scan with skill and findings
    const { data: scan, error } = await admin
      .from('scans')
      .select(`
        *,
        skill:skills(name, file_path),
        findings:findings(severity, category)
      `)
      .eq('id', id)
      .single()

    if (error || !scan) {
      // Return a generic "not found" badge
      const svg = renderNotFoundSvg()
      return new NextResponse(svg, {
        status: 404,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'no-cache',
        },
      })
    }

    // Build repo label from file_path (e.g. "github:owner/repo/file.md" → "owner/repo")
    const filePath = (scan.skill as any)?.file_path || ''
    let repoLabel = (scan.skill as any)?.name || 'unknown'
    const githubMatch = filePath.match(/^github:([^/]+\/[^/]+)\//)
    if (githubMatch) {
      repoLabel = githubMatch[1]
    }

    // Format scan date
    const scanDate = scan.completed_at || scan.started_at
    const dateStr = new Date(scanDate).toISOString().split('T')[0]

    const badgeData = buildBadgeData(repoLabel, scan.findings as any[], dateStr)
    const svg = renderBadgeSvg(badgeData)

    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    })
  } catch (error) {
    console.error('Badge error:', error)
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
