import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ScanWithDetails, SeverityLevel, FindingCategory } from '@/lib/types'
import ScanDisclaimer from '@/app/components/scan-disclaimer'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ScanDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: scan, error } = await supabase
    .from('scans')
    .select(`
      *,
      skill:skills(*),
      findings:findings(*)
    `)
    .eq('id', id)
    .single()

  if (error || !scan) {
    notFound()
  }

  const scanWithDetails = scan as ScanWithDetails

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'scanning': return 'bg-brand-accent-light text-brand-accent'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'failed': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      <ScanDisclaimer />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-mono text-2xl font-bold text-brand-text">Scan details</h1>
          <p className="text-brand-muted mt-2">
            Findings for &quot;{scanWithDetails.skill.name}&quot;
          </p>
        </div>

        {/* Scan Overview */}
        <div className="bg-brand-surface border border-brand-border mb-8">
          <div className="px-6 py-4 border-b border-brand-border">
            <h2 className="font-mono text-sm font-bold text-brand-text">Overview</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <div>
                <dt className="font-mono text-xs text-brand-muted">Skill</dt>
                <dd className="mt-1 text-sm text-brand-text">{scanWithDetails.skill.name}</dd>
              </div>
              <div>
                <dt className="font-mono text-xs text-brand-muted">Status</dt>
                <dd className="mt-1">
                  <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${getStatusColor(scanWithDetails.status)}`}>
                    {scanWithDetails.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="font-mono text-xs text-brand-muted">Started</dt>
                <dd className="mt-1 text-sm text-brand-text font-mono">
                  {new Date(scanWithDetails.started_at).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-xs text-brand-muted">Completed</dt>
                <dd className="mt-1 text-sm text-brand-text font-mono">
                  {scanWithDetails.completed_at
                    ? new Date(scanWithDetails.completed_at).toLocaleString()
                    : 'N/A'
                  }
                </dd>
              </div>
            </div>
            {scanWithDetails.error_message && (
              <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-400">
                <p className="text-sm text-red-800">
                  <span className="font-bold">Error:</span> {scanWithDetails.error_message}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Findings Summary */}
        <div className="bg-brand-surface border border-brand-border mb-8">
          <div className="px-6 py-4 border-b border-brand-border">
            <h2 className="font-mono text-sm font-bold text-brand-text">Summary</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
        </div>

        {/* Detailed Findings */}
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
                  <p className="text-xs text-brand-muted mt-1">
                    {findings.length} finding{findings.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="p-6 space-y-4">
                  {findings.map(finding => (
                    <div key={finding.id} className="border border-brand-border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                        <h3 className="font-mono text-sm font-bold text-brand-text min-w-0">
                          {finding.title}
                        </h3>
                        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${getSeverityColor(finding.severity)}`}>
                          {finding.severity}
                        </span>
                      </div>
                      <p className="text-sm text-brand-muted mb-4">{finding.description}</p>

                      {finding.line_number && (
                        <div className="mb-3">
                          <span className="font-mono text-xs text-brand-muted">Line {finding.line_number}</span>
                        </div>
                      )}

                      {finding.code_snippet && (
                        <div className="mb-4">
                          <div className="bg-gray-900 p-4 overflow-x-auto">
                            <pre className="font-mono text-xs text-gray-100">
                              <code>{finding.code_snippet}</code>
                            </pre>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="font-mono text-xs text-brand-muted">
                          Confidence: {Math.round((finding.confidence || 0) * 100)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* No findings message */}
        {scanWithDetails.findings.length === 0 && (
          <div className="bg-brand-surface border border-brand-border p-8 text-center">
            <div className="font-mono text-lg font-bold text-brand-text">No findings detected</div>
            <p className="text-sm text-brand-muted mt-2">
              This skill appears to be safe based on our analysis.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
