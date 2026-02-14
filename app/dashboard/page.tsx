'use client'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { DashboardStats, Finding, SeverityLevel, FindingCategory } from '@/lib/types'
import AppNav from '@/app/components/app-nav'

function getSeverityColor(severity: SeverityLevel) {
  switch (severity) {
    case 'low':
      return 'bg-green-100 text-green-800'
    case 'medium':
      return 'bg-yellow-100 text-yellow-800'
    case 'high':
      return 'bg-orange-100 text-orange-800'
    case 'critical':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

function StatCard({ title, value, color = 'blue' }: { title: string; value: number; color?: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
    default: 'bg-gray-500'
  }
  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
        <dd className="mt-1 text-3xl font-semibold text-gray-900">{value}</dd>
      </div>
      <div className={`${colorClasses[color] || colorClasses.default} h-1`}></div>
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentFindings, setRecentFindings] = useState<Array<Finding & { skillName: string }> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const severities: Array<SeverityLevel> = ['low', 'medium', 'high', 'critical']
  const categories: Array<FindingCategory> = ['malware', 'data_exfiltration', 'behavior_mismatch', 'privilege_escalation', 'other']

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const supabase = createClient()

        // Fetch total counts for skills and scans
        const [skillsResult, scansResult] = await Promise.all([
          supabase.from('skills').select('*', { count: 'exact', head: true }),
          supabase.from('scans').select('*', { count: 'exact', head: true })
        ])
        const totalSkills = skillsResult.count ?? 0
        const totalScans = scansResult.count ?? 0

        // Fetch all completed scans
        const { data: completedScans, error: scansError } = await supabase
          .from('scans')
          .select('id, skill_id, started_at')
          .eq('status', 'completed')
          .order('started_at', { ascending: false })

        if (scansError) throw scansError

        // Group completed scans by skill_id and get the latest per skill
        const latestScansBySkill: Record<string, { id: string; started_at: string }> = {}
        completedScans?.forEach(scan => {
          const skillId = scan.skill_id
          if (!latestScansBySkill[skillId] || new Date(scan.started_at) > new Date(latestScansBySkill[skillId].started_at)) {
            latestScansBySkill[skillId] = { id: scan.id, started_at: scan.started_at }
          }
        })
        const latestScanIds = Object.values(latestScansBySkill).map(s => s.id)

        // Fetch findings for those latest scans
        const { data: latestFindings, error: findingsError } = await supabase
          .from('findings')
          .select('scan_id, severity, category')
          .in('scan_id', latestScanIds)

        if (findingsError) throw findingsError

        // Group findings by scan_id
        const findingsByScanId: Record<string, { severity: SeverityLevel; category: FindingCategory }[]> = {}
        latestFindings?.forEach(finding => {
          if (!findingsByScanId[finding.scan_id]) {
            findingsByScanId[finding.scan_id] = []
          }
          findingsByScanId[finding.scan_id].push(finding)
        })

        // Compute safe and unsafe skills based on whether latest scan has any findings
        let safeSkills = 0
        let unsafeSkills = 0
        Object.values(latestScansBySkill).forEach(scan => {
          const scanFindings = findingsByScanId[scan.id] || []
          if (scanFindings.length > 0) {
            unsafeSkills++
          } else {
            safeSkills++
          }
        })

        // Fetch overall findings counts by severity
        const severityCounts: Record<SeverityLevel, number> = {} as any
        const categoryCounts: Record<FindingCategory, number> = {} as any

        await Promise.all(
          severities.map(async severity => {
            const { count } = await supabase.from('findings').select('*', { count: 'exact', head: true }).eq('severity', severity)
            severityCounts[severity] = count || 0
          })
        )

        await Promise.all(
          categories.map(async category => {
            const { count } = await supabase.from('findings').select('*', { count: 'exact', head: true }).eq('category', category)
            categoryCounts[category] = count || 0
          })
        )

        // Fetch recent findings with skill_id
        const { data: recentFindingsData, error: recentFindingsError } = await supabase
          .from('findings')
          .select('id, scan_id, title, severity, category, description, created_at, skill_id')
          .order('created_at', { ascending: false })
          .limit(10)

        if (recentFindingsError) throw recentFindingsError

        // Fetch skill names for the recent findings
        const skillIds = recentFindingsData?.map(f => f.skill_id).filter((id, i, arr) => arr.indexOf(id) === i) || []
        const { data: skillsData } = await supabase.from('skills').select('id, name').in('id', skillIds)
        const skillMap = new Map(skillsData?.map(s => [s.id, s.name]) || [])

        const recentFindingsWithSkill: Array<Finding & { skillName: string }> = (recentFindingsData || []).map(f => ({
          ...f,
          skillName: skillMap.get(f.skill_id) || 'N/A'
        }))

        setStats({
          totalSkills,
          totalScans,
          safeSkills,
          unsafeSkills,
          findingsBySeverity: severityCounts,
          findingsByCategory: categoryCounts
        })
        setRecentFindings(recentFindingsWithSkill)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppNav />
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppNav />
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <p className="text-red-600 text-lg">Error loading dashboard: {error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!stats || (stats.totalSkills === 0 && stats.totalScans === 0)) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppNav />
        <div className="flex items-center justify-center py-32">
          <div className="text-center max-w-md">
            <div className="mx-auto w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
              <svg className="h-8 w-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No skills scanned yet</h2>
            <p className="text-gray-600 mb-6">Upload a Claude Code skill file or scan a directory to get started.</p>
            <div className="flex gap-3 justify-center">
              <Link
                href="/scan/file"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Upload File
              </Link>
              <Link
                href="/scan/directory"
                className="inline-flex items-center gap-2 px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors"
              >
                Scan Directory
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav />
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <Link
            href="/scan/file"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
          >
            New Scan
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatCard title="Total Skills" value={stats.totalSkills} color="blue" />
          <StatCard title="Total Scans" value={stats.totalScans} color="blue" />
          <StatCard title="Safe Skills" value={stats.safeSkills} color="green" />
          <StatCard title="Unsafe Skills" value={stats.unsafeSkills} color="red" />
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 mb-8">
          {/* Findings by Severity */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Findings by Severity</h2>
            <div className="space-y-4">
              {severities.map(severity => {
                const count = stats.findingsBySeverity[severity] || 0
                const total = Object.values(stats.findingsBySeverity).reduce((a, b) => a + b, 0)
                const percentage = total > 0 ? Math.round((count / total) * 100) : 0
                const colorMap: Record<SeverityLevel, string> = {
                  low: 'bg-green-500',
                  medium: 'bg-yellow-500',
                  high: 'bg-orange-500',
                  critical: 'bg-red-500'
                }
                return (
                  <div key={severity}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize">{severity}</span>
                      <span>{count} ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div className={`${colorMap[severity]} h-2.5 rounded-full`} style={{ width: `${percentage}%` }}></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Findings by Category */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Findings by Category</h2>
            <div className="space-y-4">
              {categories.map(category => {
                const count = stats.findingsByCategory[category] || 0
                const total = Object.values(stats.findingsByCategory).reduce((a, b) => a + b, 0)
                const percentage = total > 0 ? Math.round((count / total) * 100) : 0
                return (
                  <div key={category}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize">{category.replace('_', ' ')}</span>
                      <span>{count} ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${percentage}%` }}></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Recent Findings Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Recent Findings</h2>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Skill</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Severity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentFindings && recentFindings.length > 0 ? (
                recentFindings.map(finding => (
                  <tr key={finding.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{finding.skillName}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{finding.title}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getSeverityColor(finding.severity)}`}>
                        {finding.severity}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{finding.category.replace('_', ' ')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(finding.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">No findings found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
