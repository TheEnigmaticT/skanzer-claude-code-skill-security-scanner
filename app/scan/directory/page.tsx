'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { Skill, Scan, Finding, ScanWithDetails, SeverityLevel, FindingCategory } from '@/lib/types'
import AppNav from '@/app/components/app-nav'

export default function DirectoryScanPage() {
  const supabase = createClient()
  const [skills, setSkills] = useState<Skill[]>([])
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([])
  const [scans, setScans] = useState<ScanWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch skills on mount
  useEffect(() => {
    async function fetchSkills() {
      const { data, error } = await supabase
        .from('skills')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        setError(error.message)
      } else {
        setSkills(data || [])
      }
      setLoading(false)
    }
    fetchSkills()
  }, [supabase])

  // Fetch scans periodically to update status
  useEffect(() => {
    if (scans.length === 0) return

    const interval = setInterval(async () => {
      const { data, error } = await supabase
        .from('scans')
        .select(`
          *,
          skill:skills(*),
          findings:findings(*)
        `)
        .in('id', scans.map(s => s.id))

      if (!error && data) {
        setScans(prev => {
          // Update existing scans with new data, preserving order
          const updatedMap = new Map(data.map(s => [s.id, s as ScanWithDetails]))
          return prev.map(p => updatedMap.get(p.id) || p)
        })
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [scans, supabase])

  const handleScan = async () => {
    if (selectedSkillIds.length === 0) return

    setScanning(true)
    setError(null)

    // Create a scan for each selected skill
    const newScans = selectedSkillIds.map(skillId => ({
      skill_id: skillId,
      status: 'pending' as const,
      started_at: new Date().toISOString()
    }))

    const { error: insertError } = await supabase
      .from('scans')
      .insert(newScans)

    if (insertError) {
      setError(insertError.message)
      setScanning(false)
      return
    }

    // Fetch the created scans to display
    const { data: createdScans } = await supabase
      .from('scans')
      .select(`
        *,
        skill:skills(*),
        findings:findings(*)
      `)
      .in('skill_id', selectedSkillIds)
      .order('started_at', { ascending: false })
      .limit(selectedSkillIds.length)

    if (createdScans) {
      setScans(prev => [...createdScans as ScanWithDetails[], ...prev])
    }

    setScanning(false)
    setSelectedSkillIds([])
  }

  const toggleSkillSelection = (skillId: string) => {
    setSelectedSkillIds(prev =>
      prev.includes(skillId)
        ? prev.filter(id => id !== skillId)
        : [...prev, skillId]
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="text-center">
          <p className="font-mono text-sm text-brand-muted">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      <AppNav />
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="font-mono text-2xl font-bold text-brand-text">Directory Scan</h1>
          <p className="mt-2 text-brand-muted">
            Select multiple skills to analyze in bulk. The scanner will check for data exfiltration,
            behavior mismatches, and privilege escalation.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-brand-surface border border-brand-border mb-8">
          <div className="px-4 py-5 sm:p-6">
            <h2 className="font-mono text-lg font-bold text-brand-text mb-4">Select Skills</h2>

            {skills.length === 0 ? (
              <p className="text-brand-muted">No skills available. Upload some skills first.</p>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {skills.map(skill => (
                    <div
                      key={skill.id}
                      className={`border p-4 cursor-pointer transition-all ${
                        selectedSkillIds.includes(skill.id)
                          ? 'border-brand-accent bg-brand-accent-light'
                          : 'border-brand-border hover:border-brand-border hover:bg-brand-bg'
                      }`}
                      onClick={() => toggleSkillSelection(skill.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-mono text-base font-bold text-brand-text">{skill.name}</h3>
                          {skill.description && (
                            <p className="text-sm text-brand-muted mt-1 line-clamp-2">{skill.description}</p>
                          )}
                          <p className="text-xs text-brand-muted mt-2">
                            File: {skill.file_path || 'N/A'}
                          </p>
                        </div>
                        <div className={`ml-2 flex-shrink-0 w-5 h-5 border ${
                          selectedSkillIds.includes(skill.id)
                            ? 'bg-brand-accent border-brand-accent'
                            : 'border-brand-border'
                        }`}>
                          {selectedSkillIds.includes(skill.id) && (
                            <svg className="w-full h-full text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t border-brand-border pt-4">
                  <div className="text-sm text-brand-muted">
                    {selectedSkillIds.length} of {skills.length} skills selected
                  </div>
                  <button
                    onClick={handleScan}
                    disabled={selectedSkillIds.length === 0 || scanning}
                    className="inline-flex items-center px-4 py-2 border border-transparent font-mono text-sm font-bold text-white bg-brand-accent hover:bg-brand-accent-hover focus:border-brand-accent focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {scanning ? (
                      'Starting...'
                    ) : (
                      `Scan ${selectedSkillIds.length} Skill${selectedSkillIds.length !== 1 ? 's' : ''}`
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {scans.length > 0 && (
          <div className="bg-brand-surface border border-brand-border">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="font-mono text-lg font-bold text-brand-text mb-4">Recent Scans</h2>
              <div className="space-y-4">
                {scans.map(scan => (
                  <div key={scan.id} className="border border-brand-border p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-mono text-base font-bold text-brand-text">{scan.skill.name}</h3>
                        <p className="text-sm text-brand-muted">
                          Started: {new Date(scan.started_at).toLocaleString()}
                        </p>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        scan.status === 'completed' ? 'bg-green-100 text-green-800' :
                        scan.status === 'failed' ? 'bg-red-100 text-red-800' :
                        scan.status === 'scanning' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {scan.status}
                      </span>
                    </div>

                    {scan.error_message && (
                      <div className="mb-3 text-sm text-red-600 bg-red-50 p-2 rounded">
                        Error: {scan.error_message}
                      </div>
                    )}

                    {scan.findings && scan.findings.length > 0 && (
                      <div>
                        <h4 className="font-mono text-base font-bold text-brand-text mb-2">
                          Findings ({scan.findings.length})
                        </h4>
                        <div className="space-y-3">
                          {scan.findings.map(finding => (
                            <div key={finding.id} className="border-l-4 pl-3 py-1" style={{
                              borderColor: finding.severity === 'critical' ? '#ef4444' :
                                          finding.severity === 'high' ? '#f97316' :
                                          finding.severity === 'medium' ? '#eab308' : '#22c55e'
                            }}>
                              <div className="flex justify-between items-start">
                                <span className="font-medium text-brand-text">{finding.title}</span>
                                <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                  finding.severity === 'critical' ? 'bg-red-100 text-red-800' :
                                  finding.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                                  finding.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-green-100 text-green-800'
                                }`}>
                                  {finding.severity}
                                </span>
                              </div>
                              <p className="text-sm text-brand-muted mt-1">{finding.description}</p>
                              {finding.category && (
                                <p className="text-xs text-brand-muted mt-1">
                                  Category: {finding.category}
                                </p>
                              )}
                              {finding.line_number && (
                                <p className="text-xs text-brand-muted">
                                  Line: {finding.line_number}
                                </p>
                              )}
                              {finding.code_snippet && (
                                <pre className="mt-2 text-xs bg-brand-bg p-2 rounded overflow-x-auto">
                                  <code>{finding.code_snippet}</code>
                                </pre>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {scan.status === 'completed' && (!scan.findings || scan.findings.length === 0) && (
                      <p className="text-sm text-green-600">No issues found. Skill appears safe.</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
