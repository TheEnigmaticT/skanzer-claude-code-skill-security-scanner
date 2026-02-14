'use client'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { SeverityLevel, FindingCategory, Finding } from '@/lib/types'
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

interface DashboardData {
  totalSkills: number
  totalScans: number
  safeSkills: number
  unsafeSkills: number
  findingsBySeverity: Record<SeverityLevel, number>
  findingsByCategory: Record<FindingCategory, number>
  recentFindings: Array<Finding & { skillName: string }>
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
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

        // Single query: get all scans with their skill name and findings
        const { data: scans, error: scansError } = await supabase
          .from('scans')
          .select(`
            id, skill_id, status, started_at,
            skill:skills(id, name),
            findings:findings(id, scan_id, skill_id, title, severity, category, description, created_at)
          `)
          .order('started_at', { ascending: false })

        if (scansError) throw new Error(scansError.message)

        const allScans = scans || []
        const totalScans = allScans.length

        // Unique skills
        const skillIds = new Set(allScans.map(s => s.skill_id))
        const totalSkills = skillIds.size

        // For each skill, find its latest completed scan
        const latestBySkill: Record<string, typeof allScans[0]> = {}
        allScans.forEach(scan => {
          if (scan.status !== 'completed') return
          if (!latestBySkill[scan.skill_id]) {
            latestBySkill[scan.skill_id] = scan
          }
        })

        let safeSkills = 0
        let unsafeSkills = 0
        const severityCounts: Record<SeverityLevel, number> = { low: 0, medium: 0, high: 0, critical: 0 }
        const categoryCounts: Record<FindingCategory, number> = { malware: 0, data_exfiltration: 0, behavior_mismatch: 0, privilege_escalation: 0, other: 0 }

        Object.values(latestBySkill).forEach(scan => {
          const findings = scan.findings || []
          if (findings.length > 0) {
            unsafeSkills++
            findings.forEach(f => {
              if (f.severity in severityCounts) severityCounts[f.severity as SeverityLevel]++
              if (f.category in categoryCounts) categoryCounts[f.category as FindingCategory]++
            })
          } else {
            safeSkills++
          }
        })

        // Recent findings across all scans
        const allFindings = allScans.flatMap(scan =>
          (scan.findings || []).map(f => ({
            ...f,
            skillName: (scan.skill as any)?.name || 'Unknown'
          }))
        )
        allFindings.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        const recentFindings = allFindings.slice(0, 10)

        setData({
          totalSkills,
          totalScans,
          safeSkills,
          unsafeSkills,
          findingsBySeverity: severityCounts,
          findingsByCategory: categoryCounts,
          recentFindings
        })
      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard')
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

  if (!data || (data.totalSkills === 0 && data.totalScans === 0)) {
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
          <StatCard title="Skills" value={data.totalSkills} />
          <StatCard title="Scans" value={data.totalScans} />
          <StatCard title="Clean" value={data.safeSkills} />
          <StatCard title="Flagged" value={data.unsafeSkills} accent />
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 mb-8">
          {/* Findings by Severity */}
          <div className="bg-brand-surface border border-brand-border p-6">
            <h2 className="font-mono text-sm font-bold text-brand-text mb-4">By severity</h2>
            <div className="space-y-3">
              {severities.map(severity => {
                const count = data.findingsBySeverity[severity] || 0
                const total = Object.values(data.findingsBySeverity).reduce((a, b) => a + b, 0)
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
                const count = data.findingsByCategory[category] || 0
                const total = Object.values(data.findingsByCategory).reduce((a, b) => a + b, 0)
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
        <div className="bg-brand-surface border border-brand-border mb-8">
          <div className="px-4 sm:px-6 py-4 border-b border-brand-border">
            <h2 className="font-mono text-sm font-bold text-brand-text">Recent findings</h2>
          </div>
          <div className="overflow-x-auto">
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
              {data.recentFindings.length > 0 ? (
                data.recentFindings.map(finding => (
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
        </div>
      </main>
    </div>
  )
}
