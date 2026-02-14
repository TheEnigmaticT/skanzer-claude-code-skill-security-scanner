import { createServiceClient } from '@/lib/supabase/server'
import { computeRiskLevel, type RiskLevel } from '@/lib/badge'
import type { Finding, ScanWithDetails } from '@/lib/types'

export interface RepoParsed {
  owner: string
  repo: string
}

export interface SkillSummary {
  id: string
  name: string
  file_path: string
  riskLevel: RiskLevel
  latestScan: {
    id: string
    completed_at: string
    status: string
  } | null
  findings: Finding[]
  findingCounts: Record<string, number>
}

export interface RepoSummary {
  owner: string
  repo: string
  skills: SkillSummary[]
  aggregateRisk: RiskLevel
  totalFindings: number
  lastScanDate: string | null
}

/**
 * Parse a github file_path like "github:owner/repo/path/file.md"
 * into { owner, repo } or null if not a github path.
 */
export function parseGitHubFilePath(filePath: string): RepoParsed | null {
  const match = filePath.match(/^github:([^/]+)\/([^/]+)\//)
  if (!match) return null
  return { owner: match[1], repo: match[2] }
}

/**
 * Fetch all skills for a given GitHub repo with their latest scans and findings.
 * Uses the service client (no auth required — public data).
 */
export async function getRepoSummary(owner: string, repo: string): Promise<RepoSummary | null> {
  const admin = createServiceClient()

  const { data: skills, error } = await admin
    .from('skills')
    .select('*, scans(*, findings(*))')
    .like('file_path', `github:${owner}/${repo}/%`)

  if (error || !skills || skills.length === 0) {
    return null
  }

  const skillSummaries: SkillSummary[] = skills.map((skill: any) => {
    // Pick the latest completed scan
    const completedScans = (skill.scans || [])
      .filter((s: any) => s.status === 'completed')
      .sort((a: any, b: any) =>
        new Date(b.completed_at || b.started_at).getTime() -
        new Date(a.completed_at || a.started_at).getTime()
      )

    const latestScan = completedScans[0] || null
    const findings: Finding[] = latestScan?.findings || []

    const findingCounts: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 }
    for (const f of findings) {
      findingCounts[f.severity] = (findingCounts[f.severity] || 0) + 1
    }

    return {
      id: skill.id,
      name: skill.name,
      file_path: skill.file_path,
      riskLevel: computeRiskLevel(findings),
      latestScan: latestScan ? {
        id: latestScan.id,
        completed_at: latestScan.completed_at || latestScan.started_at,
        status: latestScan.status,
      } : null,
      findings,
      findingCounts,
    }
  })

  // Sort by risk: worst first
  const riskOrder: Record<RiskLevel, number> = { high_risk: 0, caution: 1, low_risk: 2, passed: 3 }
  skillSummaries.sort((a, b) => riskOrder[a.riskLevel] - riskOrder[b.riskLevel])

  // Aggregate risk = worst of all skills
  const allFindings = skillSummaries.flatMap(s => s.findings)
  const aggregateRisk = computeRiskLevel(allFindings)

  // Last scan date across all skills
  const scanDates = skillSummaries
    .filter(s => s.latestScan)
    .map(s => new Date(s.latestScan!.completed_at).getTime())
  const lastScanDate = scanDates.length > 0
    ? new Date(Math.max(...scanDates)).toISOString().split('T')[0]
    : null

  return {
    owner,
    repo,
    skills: skillSummaries,
    aggregateRisk,
    totalFindings: allFindings.length,
    lastScanDate,
  }
}
