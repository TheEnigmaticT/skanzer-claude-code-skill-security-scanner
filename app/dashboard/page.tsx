'use client'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { DashboardStats, Finding, SeverityLevel, FindingCategory } from '@/lib/types'
import AppNav from '@/app/components/app-nav'

function getSeverityColor(severity: SeverityLevel) {
  switch (severity) {
    case 'low': return 'bg-green-100 text-green-800'
    case 'medium': return 'bg-yellow-100 text-yellow-800'
    case 'high': return 'bg-orange-100 text-orange-800'
    case 'critical': return 'bg-red-100 text-red-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}

function StatCard({ title, value, accent = false }: { title: string; value: number; accent?: boolean }) {
  return (
    <div className="bg-brand-surface border border-brand-border p-5">
      <dt className="font-mono text-xs text-brand-muted">{title}</dt>
      <dd className={`mt-1 font-mono text-3xl font-bold ${accent ? 'text-brand-accent' : 'text-brand-text'}`}>{value}</dd>
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

        const [skillsResult, scansResult] = await Promise.all([
          supabase.from('skills').select('*', { count: 'exact', head: true }),
          supabase.from('scans').select('*', { count: 'exact', head: true })
        ])
        const totalSkills = skillsResult.count ?? 0
        const totalScans = scansResult.count ?? 0

        const { data: completedScans, error: scansError } = await supabase
          .from('scans')
          .select('id, skill_id, started_at')
          .eq('status', 'completed')
          .order('started_at', { ascending: false })

        if (scansError) throw scansError

        const latestScansBySkill: Record<string, { id: string; started_at: string }> = {}
        completedScans?.forEach(scan => {
          const skillId = scan.skill_id
          if (!latestScansBySkill[skillId] || new Date(scan.started_at) > new Date(latestScansBySkill[skillId].started_at)) {
            latestScansBySkill[skillId] = { id: scan.id, started_at: scan.started_at }
          }
        })
        const latestScanIds = Object.values(latestScansBySkill).map(s => s.id)

        const { data: latestFindings, error: findingsError } = await supabase
          .from('findings')
          .select('scan_id, severity, category')
          .in('scan_id', latestScanIds)

        if (findingsError) throw findingsError

        const findingsByScanId: Record<string, { severity: SeverityLevel; category: FindingCategory }[]> = {}
        latestFindings?.forEach(finding => {
          if (!findingsByScanId[finding.scan_id]) {
            findingsByScanId[finding.scan_id] = []
          }
          findingsByScanId[finding.scan_id].push(finding)
        })

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

        const { data: recentFindingsData, error: recentFindingsError } = await supabase
          .from('findings')
          .select('id, scan_id, title, severity, category, description, created_at, skill_id')
          .order('created_at', { ascending: false })
          .limit(10)

        if (recentFindingsError) throw recentFindingsError

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
      <div className="min-h-screen bg-brand-bg">
        <AppNav />
        <div className="flex items-center justify-center py-32">
          <p className="font-mono text-sm text-brand-muted">Loading...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-brand-bg">
        <AppNav />
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <p className="text-red-700 text-sm">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 font-mono text-sm font-bold bg-brand-accent text-white px-4 py-2 hover:bg-brand-accent-hover transition-colors"
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
      <div className="min-h-screen bg-brand-bg">
        <AppNav />
        <div className="flex items-center justify-center py-32">
          <div className="max-w-md text-center">
            <h2 className="font-mono text-xl font-bold text-brand-text mb-2">No skills scanned yet</h2>
            <p className="text-brand-muted mb-6">Upload a Claude Code skill file or scan a directory to get started.</p>
            <div className="flex gap-3 justify-center">
              <Link
                href="/scan/file"
                className="font-mono text-sm font-bold bg-brand-accent text-white px-5 py-2.5 hover:bg-brand-accent-hover transition-colors"
              >
                Upload file
              </Link>
              <Link
                href="/scan/directory"
                className="font-mono text-sm font-bold border border-brand-border text-brand-text px-5 py-2.5 hover:bg-brand-accent-light transition-colors"
              >
                Scan directory
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      <AppNav />
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-mono text-2xl font-bold text-brand-text">Dashboard</h1>
          <Link
            href="/scan/file"
            className="font-mono text-sm font-bold bg-brand-accent text-white px-4 py-2 hover:bg-brand-accent-hover transition-colors"
          >
            New scan
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-brand-border mb-8">
          <StatCard title="Skills" value={stats.totalSkills} />
          <StatCard title="Scans" value={stats.totalScans} />
          <StatCard title="Clean" value={stats.safeSkills} />
          <StatCard title="Flagged" value={stats.unsafeSkills} accent />
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 mb-8">
          {/* Findings by Severity */}
          <div className="bg-brand-surface border border-brand-border p-6">
            <h2 className="font-mono text-sm font-bold text-brand-text mb-4">By severity</h2>
            <div className="space-y-3">
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
                    <div className="flex justify-between font-mono text-xs mb-1">
                      <span className="capitalize text-brand-muted">{severity}</span>
                      <span className="text-brand-text">{count}</span>
                    </div>
                    <div className="w-full bg-brand-border h-1.5">
                      <div className={`${colorMap[severity]} h-1.5`} style={{ width: `${percentage}%` }}></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Findings by Category */}
          <div className="bg-brand-surface border border-brand-border p-6">
            <h2 className="font-mono text-sm font-bold text-brand-text mb-4">By category</h2>
            <div className="space-y-3">
              {categories.map(category => {
                const count = stats.findingsByCategory[category] || 0
                const total = Object.values(stats.findingsByCategory).reduce((a, b) => a + b, 0)
                const percentage = total > 0 ? Math.round((count / total) * 100) : 0
                return (
                  <div key={category}>
                    <div className="flex justify-between font-mono text-xs mb-1">
                      <span className="text-brand-muted">{category.replace(/_/g, ' ')}</span>
                      <span className="text-brand-text">{count}</span>
                    </div>
                    <div className="w-full bg-brand-border h-1.5">
                      <div className="bg-brand-accent h-1.5" style={{ width: `${percentage}%` }}></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Recent Findings */}
        <div className="bg-brand-surface border border-brand-border overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-brand-border">
            <h2 className="font-mono text-sm font-bold text-brand-text">Recent findings</h2>
          </div>
          <table className="min-w-full divide-y divide-brand-border">
            <thead>
              <tr className="bg-brand-bg">
                <th className="px-6 py-3 text-left font-mono text-xs text-brand-muted">Skill</th>
                <th className="px-6 py-3 text-left font-mono text-xs text-brand-muted">Finding</th>
                <th className="px-6 py-3 text-left font-mono text-xs text-brand-muted">Severity</th>
                <th className="px-6 py-3 text-left font-mono text-xs text-brand-muted">Category</th>
                <th className="px-6 py-3 text-left font-mono text-xs text-brand-muted">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {recentFindings && recentFindings.length > 0 ? (
                recentFindings.map(finding => (
                  <tr key={finding.id}>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-brand-text">{finding.skillName}</td>
                    <td className="px-6 py-3 text-sm text-brand-text">{finding.title}</td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs font-medium rounded ${getSeverityColor(finding.severity)}`}>
                        {finding.severity}
                      </span>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-brand-muted">{finding.category.replace(/_/g, ' ')}</td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-brand-muted font-mono">{new Date(finding.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-brand-muted">No findings yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
