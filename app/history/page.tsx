'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ScanWithDetails, SeverityLevel, FindingCategory } from '@/lib/types'
import Link from 'next/link'
import AppNav from '@/app/components/app-nav'

export default function HistoryPage() {
  const [scans, setScans] = useState<ScanWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filter states
  const [selectedSeverities, setSelectedSeverities] = useState<SeverityLevel[]>([])
  const [selectedCategories, setSelectedCategories] = useState<FindingCategory[]>([])

  const severities: SeverityLevel[] = ['low', 'medium', 'high', 'critical']
  const categories: FindingCategory[] = ['malware', 'data_exfiltration', 'behavior_mismatch', 'privilege_escalation', 'other']

  useEffect(() => {
    async function fetchScans() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('scans')
        .select(`
          *,
          skill:skills(*),
          findings:findings(*)
        `)
        .order('started_at', { ascending: false })

      if (error) {
        setError(error.message)
      } else {
        setScans(data || [])
      }
      setLoading(false)
    }

    fetchScans()
  }, [])

  // Filter logic
  const filteredScans = scans.filter(scan => {
    // If no filters, include all
    if (selectedSeverities.length === 0 && selectedCategories.length === 0) {
      return true
    }

    const hasMatchingSeverity = selectedSeverities.length === 0 
      ? true 
      : scan.findings.some(finding => selectedSeverities.includes(finding.severity))

    const hasMatchingCategory = selectedCategories.length === 0
      ? true
      : scan.findings.some(finding => selectedCategories.includes(finding.category))

    return hasMatchingSeverity && hasMatchingCategory
  })

  const toggleSeverity = (severity: SeverityLevel) => {
    setSelectedSeverities(prev => 
      prev.includes(severity) 
        ? prev.filter(s => s !== severity)
        : [...prev, severity]
    )
  }

  const toggleCategory = (category: FindingCategory) => {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    )
  }

  const getSeverityColor = (severity: SeverityLevel) => {
    switch (severity) {
      case 'low':
        return 'bg-green-100 text-green-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'high':
        return 'bg-orange-100 text-orange-800'
      case 'critical':
        return 'bg-red-100 text-red-800'
    }
  }

  const getCategoryLabel = (category: FindingCategory) => {
    switch (category) {
      case 'malware':
        return 'Malware'
      case 'data_exfiltration':
        return 'Data Exfiltration'
      case 'behavior_mismatch':
        return 'Behavior Mismatch'
      case 'privilege_escalation':
        return 'Privilege Escalation'
      case 'other':
        return 'Other'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="grid grid-cols-1 gap-4 mt-6">
              {[1,2,3].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800">Error loading scan history: {error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Scan History</h1>
          <p className="mt-2 text-gray-600">
            View and filter your past security scans.
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Filters</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Severity Filter */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Severity</h3>
              <div className="flex flex-wrap gap-2">
                {severities.map(severity => (
                  <button
                    key={severity}
                    onClick={() => toggleSeverity(severity)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      selectedSeverities.includes(severity)
                        ? getSeverityColor(severity)
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {severity.charAt(0).toUpperCase() + severity.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Category Filter */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Detection Pattern</h3>
              <div className="flex flex-wrap gap-2">
                {categories.map(category => (
                  <button
                    key={category}
                    onClick={() => toggleCategory(category)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      selectedCategories.includes(category)
                        ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {getCategoryLabel(category)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {(selectedSeverities.length > 0 || selectedCategories.length > 0) && (
            <div className="mt-4 flex items-center">
              <span className="text-sm text-gray-500 mr-2">Active filters:</span>
              <div className="flex flex-wrap gap-2">
                {selectedSeverities.map(severity => (
                  <span
                    key={severity}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800"
                  >
                    {severity}
                    <button
                      onClick={() => toggleSeverity(severity)}
                      className="ml-1 text-green-600 hover:text-green-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {selectedCategories.map(category => (
                  <span
                    key={category}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {getCategoryLabel(category)}
                    <button
                      onClick={() => toggleCategory(category)}
                      className="ml-1 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <button
                  onClick={() => {
                    setSelectedSeverities([])
                    setSelectedCategories([])
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700 ml-2"
                >
                  Clear all
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Scan List */}
        {filteredScans.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-8 text-center">
            <p className="text-gray-500">
              {scans.length === 0 
                ? 'No scans found. Upload a skill and run a scan to get started.'
                : 'No scans match the current filters.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredScans.map(scan => {
              const totalFindings = scan.findings.length
              const severityCounts = scan.findings.reduce((acc, finding) => {
                acc[finding.severity] = (acc[finding.severity] || 0) + 1
                return acc
              }, {} as Record<SeverityLevel, number>)

              return (
                <div key={scan.id} className="bg-white shadow rounded-lg p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        <Link 
                          href={`/scans/${scan.id}`}
                          className="hover:text-blue-600 transition-colors"
                        >
                          {scan.skill.name}
                        </Link>
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Started: {new Date(scan.started_at).toLocaleString()}
                        {scan.completed_at && (
                          <span> • Completed: {new Date(scan.completed_at).toLocaleString()}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        scan.status === 'completed' 
                          ? 'bg-green-100 text-green-800'
                          : scan.status === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : scan.status === 'scanning'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {scan.status}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center space-x-4">
                    <div className="text-sm text-gray-600">
                      Total Findings: <span className="font-medium">{totalFindings}</span>
                    </div>
                    {Object.entries(severityCounts).map(([severity, count]) => (
                      <div key={severity} className="text-sm">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(severity as SeverityLevel)}`}>
                          {severity}: {count}
                        </span>
                      </div>
                    ))}
                  </div>

                  {totalFindings > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Top Findings</h4>
                      <div className="space-y-2">
                        {scan.findings.slice(0, 3).map(finding => (
                          <div key={finding.id} className="text-sm">
                            <div className="flex items-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(finding.severity)}`}>
                                {finding.severity}
                              </span>
                              <span className="ml-2 text-gray-900">{finding.title}</span>
                              {finding.category && (
                                <span className="ml-2 text-xs text-gray-500">
                                  ({getCategoryLabel(finding.category)})
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                        {scan.findings.length > 3 && (
                          <p className="text-xs text-gray-500">
                            +{scan.findings.length - 3} more findings
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mt-4">
                    <Link
                      href={`/scans/${scan.id}`}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      View Details →
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
