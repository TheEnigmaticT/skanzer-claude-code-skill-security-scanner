import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ScanWithDetails, SeverityLevel, FindingCategory } from '@/lib/types'
import { computeRiskLevel, type RiskLevel } from '@/lib/badge'
import type { Metadata } from 'next'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const admin = createServiceClient()

  const { data: scan } = await admin
    .from('scans')
    .select('*, skill:skills(name)')
    .eq('id', id)
    .single()

  const skillName = (scan?.skill as any)?.name || 'Unknown'
  const dateStr = scan?.completed_at || scan?.started_at
  const date = dateStr ? new Date(dateStr).toISOString().split('T')[0] : ''

  return {
    title: `Skanzer Report: ${skillName} - ${date}`,
    description: `Security scan report for "${skillName}" generated on ${date}`,
  }
}

export default async function PublicReportPage({ params }: PageProps) {
  const { id } = await params
  const admin = createServiceClient()

  const { data: scan, error } = await admin
    .from('scans')
    .select(`
      *,
      skill:skills(name, file_path, description),
      findings:findings(*)
    `)
    .eq('id', id)
    .single()

  if (error || !scan) {
    notFound()
  }

  const scanWithDetails = scan as ScanWithDetails
  const scanDate = scanWithDetails.completed_at || scanWithDetails.started_at
  const dateStr = new Date(scanDate).toISOString().split('T')[0]
  const riskLevel = computeRiskLevel(scanWithDetails.findings)

  const findingsByCategory = scanWithDetails.findings.reduce((acc, finding) => {
    if (!acc[finding.category]) {
      acc[finding.category] = []
    }
    acc[finding.category].push(finding)
    return acc
  }, {} as Record<FindingCategory, typeof scanWithDetails.findings>)

  const categories: FindingCategory[] = ['malware', 'data_exfiltration', 'behavior_mismatch', 'privilege_escalation', 'other']

  const getSeverityColor = (severity: SeverityLevel) => {
    switch (severity) {
      case 'low': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'critical': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getCategoryLabel = (category: FindingCategory) => {
    switch (category) {
      case 'malware': return 'Malware'
      case 'data_exfiltration': return 'Data Exfiltration'
      case 'behavior_mismatch': return 'Behavior Mismatch'
      case 'privilege_escalation': return 'Privilege Escalation'
      case 'other': return 'Other'
      default: return category
    }
  }

  const getRiskConfig = (level: RiskLevel) => {
    switch (level) {
      case 'passed': return { text: 'Passed', border: 'border-green-400', bg: 'bg-green-50', textColor: 'text-green-900' }
      case 'low_risk': return { text: 'Low Risk', border: 'border-green-400', bg: 'bg-green-50', textColor: 'text-green-900' }
      case 'caution': return { text: 'Caution', border: 'border-yellow-400', bg: 'bg-yellow-50', textColor: 'text-yellow-900' }
      case 'high_risk': return { text: 'High Risk', border: 'border-red-400', bg: 'bg-red-50', textColor: 'text-red-900' }
    }
  }

  const riskConfig = getRiskConfig(riskLevel)

  return (
    <div className="min-h-screen bg-brand-bg">
      {/* Header */}
      <header className="border-b border-brand-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <span className="font-mono text-lg font-bold text-brand-text">skanzer</span>
          <span className="font-mono text-xs text-brand-muted">{dateStr}</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Risk banner */}
        <div className={`border-l-4 p-4 sm:p-6 mb-8 ${riskConfig.border} ${riskConfig.bg}`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className={`font-mono text-xl sm:text-2xl font-bold ${riskConfig.textColor}`}>{scanWithDetails.skill.name}</h1>
              {scanWithDetails.skill.file_path && (
                <p className="font-mono text-xs text-brand-muted mt-1 break-all">{scanWithDetails.skill.file_path}</p>
              )}
            </div>
            <div className="sm:text-right">
              <div className={`font-mono text-xl sm:text-2xl font-bold ${riskConfig.textColor}`}>{riskConfig.text}</div>
              <div className="font-mono text-xs text-brand-muted">
                {scanWithDetails.findings.length} finding{scanWithDetails.findings.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>

        {/* Scan info */}
        <div className="bg-brand-surface border border-brand-border mb-8">
          <div className="px-6 py-4 border-b border-brand-border">
            <h2 className="font-mono text-sm font-bold text-brand-text">Scan details</h2>
          </div>
          <div className="p-4 sm:p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <dt className="font-mono text-xs text-brand-muted">Status</dt>
              <dd className="mt-1 text-sm text-brand-text capitalize">{scanWithDetails.status}</dd>
            </div>
            <div>
              <dt className="font-mono text-xs text-brand-muted">Scanned</dt>
              <dd className="mt-1 text-sm text-brand-text font-mono">{dateStr}</dd>
            </div>
            <div>
              <dt className="font-mono text-xs text-brand-muted">Findings</dt>
              <dd className="mt-1 text-sm text-brand-text">{scanWithDetails.findings.length}</dd>
            </div>
            <div>
              <dt className="font-mono text-xs text-brand-muted">Verdict</dt>
              <dd className="mt-1 text-sm text-brand-text font-bold">{riskConfig.text}</dd>
            </div>
          </div>
        </div>

        {/* Findings by category */}
        {scanWithDetails.findings.length > 0 && (
          <div className="bg-brand-surface border border-brand-border mb-8">
            <div className="px-6 py-4 border-b border-brand-border">
              <h2 className="font-mono text-sm font-bold text-brand-text">Summary</h2>
            </div>
            <div className="p-4 sm:p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {categories.map(category => {
                const count = findingsByCategory[category]?.length || 0
                return (
                  <div key={category} className="text-center">
                    <div className="font-mono text-2xl font-bold text-brand-text">{count}</div>
                    <div className="font-mono text-xs text-brand-muted">{getCategoryLabel(category)}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Detailed findings */}
        <div className="space-y-6">
          {categories.map(category => {
            const findings = findingsByCategory[category] || []
            if (findings.length === 0) return null

            return (
              <div key={category} className="bg-brand-surface border border-brand-border">
                <div className="px-6 py-4 border-b border-brand-border">
                  <h2 className="font-mono text-sm font-bold text-brand-text">
                    {getCategoryLabel(category)}
                  </h2>
                  <p className="text-xs text-brand-muted">
                    {findings.length} finding{findings.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="p-6 space-y-4">
                  {findings.map(finding => (
                    <div key={finding.id} className="border border-brand-border p-3 sm:p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                        <h3 className="font-mono text-sm font-bold text-brand-text">{finding.title}</h3>
                        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${getSeverityColor(finding.severity)}`}>
                          {finding.severity}
                        </span>
                      </div>
                      <p className="text-sm text-brand-muted mb-3">{finding.description}</p>

                      {finding.line_number && (
                        <p className="font-mono text-xs text-brand-muted mb-2">Line {finding.line_number}</p>
                      )}

                      {finding.code_snippet && (
                        <div className="bg-gray-900 p-3 overflow-x-auto mb-2">
                          <pre className="font-mono text-xs text-gray-100"><code>{finding.code_snippet}</code></pre>
                        </div>
                      )}

                      <div className="font-mono text-xs text-brand-muted">
                        Confidence: {Math.round((finding.confidence || 0) * 100)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* No findings */}
        {scanWithDetails.findings.length === 0 && (
          <div className="bg-brand-surface border border-brand-border p-8 text-center">
            <div className="font-mono text-lg font-bold text-brand-text">No findings detected</div>
            <p className="text-sm text-brand-muted mt-1">
              This skill appears to be safe based on our analysis.
            </p>
          </div>
        )}

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
