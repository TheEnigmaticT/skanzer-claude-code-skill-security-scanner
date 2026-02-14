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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading skills...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav />
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Directory Scan</h1>
          <p className="mt-2 text-gray-600">
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

        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-4 py-5 sm:p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Skills</h2>
            
            {skills.length === 0 ? (
              <p className="text-gray-500">No skills available. Upload some skills first.</p>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {skills.map(skill => (
                    <div 
                      key={skill.id}
                      className={`border rounded-lg p-4 cursor-pointer transition-all ${
                        selectedSkillIds.includes(skill.id)
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                      onClick={() => toggleSkillSelection(skill.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">{skill.name}</h3>
                          {skill.description && (
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{skill.description}</p>
                          )}
                          <p className="text-xs text-gray-500 mt-2">
                            File: {skill.file_path || 'N/A'}
                          </p>
                        </div>
                        <div className={`ml-2 flex-shrink-0 w-5 h-5 rounded border ${
                          selectedSkillIds.includes(skill.id)
                            ? 'bg-blue-600 border-blue-600'
                            : 'border-gray-300'
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

                <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                  <div className="text-sm text-gray-600">
                    {selectedSkillIds.length} of {skills.length} skills selected
                  </div>
                  <button
                    onClick={handleScan}
                    disabled={selectedSkillIds.length === 0 || scanning}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {scanning ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Starting...
                      </>
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
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Scans</h2>
              <div className="space-y-4">
                {scans.map(scan => (
                  <div key={scan.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-medium text-gray-900">{scan.skill.name}</h3>
                        <p className="text-sm text-gray-500">
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
                        <h4 className="font-medium text-gray-900 mb-2">
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
                                <span className="font-medium text-gray-900">{finding.title}</span>
                                <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                  finding.severity === 'critical' ? 'bg-red-100 text-red-800' :
                                  finding.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                                  finding.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-green-100 text-green-800'
                                }`}>
                                  {finding.severity}
                                </span>
                              </div>
                              <p className="text-sm text-gray-700 mt-1">{finding.description}</p>
                              {finding.category && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Category: {finding.category}
                                </p>
                              )}
                              {finding.line_number && (
                                <p className="text-xs text-gray-500">
                                  Line: {finding.line_number}
                                </p>
                              )}
                              {finding.code_snippet && (
                                <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
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
