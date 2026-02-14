import { getRepoSummary } from '@/lib/repo'
import { notFound } from 'next/navigation'
import type { RiskLevel } from '@/lib/badge'
import type { SeverityLevel, FindingCategory } from '@/lib/types'
import type { Metadata } from 'next'

export const revalidate = 300

interface PageProps {
  params: Promise<{ owner: string; repo: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { owner, repo } = await params
  const summary = await getRepoSummary(owner, repo)

  if (!summary) {
    return { title: `Skanzer: ${owner}/${repo} — Not Found` }
  }

  const riskText = getRiskConfig(summary.aggregateRisk).text
  return {
    title: `Skanzer: ${owner}/${repo} — ${riskText}`,
    description: `Security scan report for ${owner}/${repo}: ${riskText} with ${summary.totalFindings} finding${summary.totalFindings !== 1 ? 's' : ''} across ${summary.skills.length} skill${summary.skills.length !== 1 ? 's' : ''}.`,
  }
}

export default async function RepoPage({ params }: PageProps) {
  const { owner, repo } = await params
  const summary = await getRepoSummary(owner, repo)

  if (!summary) {
    notFound()
  }

  const riskConfig = getRiskConfig(summary.aggregateRisk)

  return (
    <div className="min-h-screen bg-brand-bg">
      {/* Header */}
      <header className="border-b border-brand-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <span className="font-mono text-lg font-bold text-brand-text">skanzer</span>
          <span className="font-mono text-sm text-brand-muted">{owner}/{repo}</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Risk banner */}
        <div className={`border-l-4 p-4 sm:p-6 mb-8 ${riskConfig.border} ${riskConfig.bg}`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className={`font-mono text-xl sm:text-2xl font-bold ${riskConfig.textColor}`}>
                {owner}/{repo}
              </h1>
              <p className="font-mono text-xs text-brand-muted mt-1">Repository Security Report</p>
            </div>
            <div className="sm:text-right">
              <div className={`font-mono text-xl sm:text-2xl font-bold ${riskConfig.textColor}`}>
                {riskConfig.text}
              </div>
              <div className="font-mono text-xs text-brand-muted">
                {summary.totalFindings} finding{summary.totalFindings !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="bg-brand-surface border border-brand-border mb-8">
          <div className="px-6 py-4 border-b border-brand-border">
            <h2 className="font-mono text-sm font-bold text-brand-text">Overview</h2>
          </div>
          <div className="p-4 sm:p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <dt className="font-mono text-xs text-brand-muted">Skills</dt>
              <dd className="mt-1 text-sm text-brand-text font-bold">{summary.skills.length}</dd>
            </div>
            <div>
              <dt className="font-mono text-xs text-brand-muted">Findings</dt>
              <dd className="mt-1 text-sm text-brand-text font-bold">{summary.totalFindings}</dd>
            </div>
            <div>
              <dt className="font-mono text-xs text-brand-muted">Last Scan</dt>
              <dd className="mt-1 text-sm text-brand-text font-mono">
                {summary.lastScanDate || 'N/A'}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-xs text-brand-muted">Verdict</dt>
              <dd className="mt-1 text-sm text-brand-text font-bold">{riskConfig.text}</dd>
            </div>
          </div>
        </div>

        {/* Per-skill cards */}
        <div className="space-y-4 mb-8">
          <h2 className="font-mono text-sm font-bold text-brand-text">Skills ({summary.skills.length})</h2>
          {summary.skills.map(skill => {
            const skillRisk = getRiskConfig(skill.riskLevel)
            return (
              <div key={skill.id} className="bg-brand-surface border border-brand-border">
                <div className={`border-l-4 ${skillRisk.border}`}>
                  <div className="p-4 sm:p-6">
                    {/* Skill header */}
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <h3 className="font-mono text-base font-bold text-brand-text">{skill.name}</h3>
                        <p className="font-mono text-xs text-brand-muted break-all">{skill.file_path}</p>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-bold font-mono ${skillRisk.bg} ${skillRisk.textColor}`}>
                        {skillRisk.text}
                      </span>
                    </div>

                    {/* Finding counts by severity */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {(['critical', 'high', 'medium', 'low'] as SeverityLevel[]).map(sev => {
                        const count = skill.findingCounts[sev] || 0
                        if (count === 0) return null
                        return (
                          <span key={sev} className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${getSeverityColor(sev)}`}>
                            {count} {sev}
                          </span>
                        )
                      })}
                      {skill.findings.length === 0 && (
                        <span className="text-xs text-green-700">No findings</span>
                      )}
                    </div>

                    {/* Top findings (max 3) */}
                    {skill.findings.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {skill.findings.slice(0, 3).map(finding => (
                          <div key={finding.id} className="border-l-4 pl-3 py-1" style={{
                            borderColor: finding.severity === 'critical' ? '#ef4444' :
                                        finding.severity === 'high' ? '#f97316' :
                                        finding.severity === 'medium' ? '#eab308' : '#22c55e'
                          }}>
                            <div className="flex flex-wrap items-start justify-between gap-1">
                              <span className="text-sm font-medium text-brand-text">{finding.title}</span>
                              <span className={`text-xs px-1.5 py-0.5 font-medium ${getSeverityColor(finding.severity)}`}>
                                {finding.severity}
                              </span>
                            </div>
                            <p className="text-xs text-brand-muted mt-0.5">{finding.description}</p>
                          </div>
                        ))}
                        {skill.findings.length > 3 && (
                          <p className="text-xs text-brand-muted pl-3">
                            +{skill.findings.length - 3} more finding{skill.findings.length - 3 !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Link to detailed report */}
                    {skill.latestScan && (
                      <a
                        href={`/report/${skill.latestScan.id}`}
                        className="inline-flex items-center text-sm font-mono text-brand-accent hover:text-brand-accent-hover"
                      >
                        View full report &rarr;
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Badge embed section */}
        <div className="bg-brand-surface border border-brand-border mb-8">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="font-mono text-base font-bold text-brand-text mb-4">Embed Badge</h3>
            <p className="text-sm text-brand-muted mb-4">
              Add this badge to your repository README to show its security scan status.
            </p>

            {/* Badge Preview */}
            <div className="mb-6 p-4 bg-brand-bg flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/badge/repo/${owner}/${repo}`}
                alt={`Skanzer Security Scan for ${owner}/${repo}`}
                height={20}
              />
            </div>

            {/* Markdown */}
            <div className="mb-4">
              <label className="text-sm font-medium text-brand-muted block mb-1">Markdown</label>
              <pre className="text-xs bg-brand-bg p-3 overflow-x-auto select-all">
                <code>{`[![Skanzer Security Scan](https://skanzer.ai/api/badge/repo/${owner}/${repo})](https://skanzer.ai/repo/${owner}/${repo})`}</code>
              </pre>
            </div>

            {/* HTML */}
            <div>
              <label className="text-sm font-medium text-brand-muted block mb-1">HTML</label>
              <pre className="text-xs bg-brand-bg p-3 overflow-x-auto select-all">
                <code>{`<a href="https://skanzer.ai/repo/${owner}/${repo}"><img src="https://skanzer.ai/api/badge/repo/${owner}/${repo}" alt="Skanzer Security Scan for ${owner}/${repo}"></a>`}</code>
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-brand-border text-center">
          <p className="font-mono text-xs text-brand-muted">
            skanzer &mdash; Claude Code skill security scanner
          </p>
        </div>
      </main>
    </div>
  )
}

function getRiskConfig(level: RiskLevel) {
  switch (level) {
    case 'passed': return { text: 'Passed', border: 'border-green-400', bg: 'bg-green-50', textColor: 'text-green-900' }
    case 'low_risk': return { text: 'Low Risk', border: 'border-green-400', bg: 'bg-green-50', textColor: 'text-green-900' }
    case 'caution': return { text: 'Caution', border: 'border-yellow-400', bg: 'bg-yellow-50', textColor: 'text-yellow-900' }
    case 'high_risk': return { text: 'High Risk', border: 'border-red-400', bg: 'bg-red-50', textColor: 'text-red-900' }
  }
}

function getSeverityColor(severity: SeverityLevel) {
  switch (severity) {
    case 'low': return 'bg-green-100 text-green-800'
    case 'medium': return 'bg-yellow-100 text-yellow-800'
    case 'high': return 'bg-orange-100 text-orange-800'
    case 'critical': return 'bg-red-100 text-red-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}
