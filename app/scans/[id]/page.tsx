import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ScanWithDetails, SeverityLevel, FindingCategory } from '@/lib/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ScanDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch scan with details including skill and findings
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

  // Cast to proper type
  const scanWithDetails = scan as ScanWithDetails

  // Group findings by category
  const findingsByCategory = scanWithDetails.findings.reduce((acc, finding) => {
    if (!acc[finding.category]) {
      acc[finding.category] = []
    }
    acc[finding.category].push(finding)
    return acc
  }, {} as Record<FindingCategory, typeof scanWithDetails.findings>)

  const categories: FindingCategory[] = ['data_exfiltration', 'behavior_mismatch', 'privilege_escalation', 'other']

  const getSeverityColor = (severity: SeverityLevel) => {
    switch (severity) {
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getCategoryLabel = (category: FindingCategory) => {
    switch (category) {
      case 'data_exfiltration':
        return 'Data Exfiltration'
      case 'behavior_mismatch':
        return 'Behavior Mismatch'
      case 'privilege_escalation':
        return 'Privilege Escalation'
      case 'other':
        return 'Other'
      default:
        return category
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'scanning':
        return 'bg-blue-100 text-blue-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Scan Details</h1>
          <p className="text-gray-600 mt-2">
            View detailed findings for scan &quot;{scanWithDetails.skill.name}&quot;
          </p>
        </div>

        {/* Scan Overview */}
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-6 py-5 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Scan Overview</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <dt className="text-sm font-medium text-gray-500">Skill</dt>
                <dd className="mt-1 text-sm text-gray-900">{scanWithDetails.skill.name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd className="mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(scanWithDetails.status)}`}>
                    {scanWithDetails.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Started</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(scanWithDetails.started_at).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Completed</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {scanWithDetails.completed_at 
                    ? new Date(scanWithDetails.completed_at).toLocaleString()
                    : 'N/A'
                  }
                </dd>
              </div>
            </div>
            {scanWithDetails.error_message && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">
                  <span className="font-medium">Error:</span> {scanWithDetails.error_message}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Findings Summary */}
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-6 py-5 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Findings Summary</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {categories.map(category => {
                const count = findingsByCategory[category]?.length || 0
                return (
                  <div key={category} className="bg-gray-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-gray-900">{count}</div>
                    <div className="text-sm text-gray-600">{getCategoryLabel(category)}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Detailed Findings */}
        <div className="space-y-8">
          {categories.map(category => {
            const findings = findingsByCategory[category] || []
            if (findings.length === 0) return null

            return (
              <div key={category} className="bg-white shadow rounded-lg">
                <div className="px-6 py-5 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {getCategoryLabel(category)}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {findings.length} finding{findings.length !== 1 ? 's' : ''} found
                  </p>
                </div>
                <div className="p-6 space-y-4">
                  {findings.map(finding => (
                    <div key={finding.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-lg font-medium text-gray-900">
                          {finding.title}
                        </h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(finding.severity)}`}>
                          {finding.severity}
                        </span>
                      </div>
                      <p className="text-gray-700 mb-4">{finding.description}</p>
                      
                      {finding.line_number && (
                        <div className="mb-3">
                          <span className="text-sm font-medium text-gray-500">Line: </span>
                          <span className="text-sm text-gray-900">{finding.line_number}</span>
                        </div>
                      )}
                      
                      {finding.code_snippet && (
                        <div className="mb-4">
                          <div className="bg-gray-900 rounded-md p-4 overflow-x-auto">
                            <pre className="text-sm text-gray-100">
                              <code>{finding.code_snippet}</code>
                            </pre>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                          Confidence: {Math.round((finding.confidence || 0) * 100)}%
                        </div>
                        {finding.category && (
                          <span className="text-xs text-gray-500">
                            Category: {getCategoryLabel(finding.category)}
                          </span>
                        )}
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
          <div className="bg-white shadow rounded-lg p-8 text-center">
            <div className="text-gray-500 text-lg">No findings detected</div>
            <p className="text-gray-400 text-sm mt-2">
              This skill appears to be safe based on our analysis.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
