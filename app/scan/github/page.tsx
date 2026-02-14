'use client'

import { useState } from 'react'
import type { ScanWithDetails } from '@/lib/types'
import AppNav from '@/app/components/app-nav'

interface RepoFile {
  path: string
  size: number
}

interface RepoInfo {
  owner: string
  repo: string
  branch: string
}

type Step = 'url' | 'select' | 'results'

export default function GitHubScanPage() {
  const [step, setStep] = useState<Step>('url')
  const [url, setUrl] = useState('')
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null)
  const [files, setFiles] = useState<RepoFile[]>([])
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [scans, setScans] = useState<ScanWithDetails[]>([])
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleFetchFiles = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/scan/github/tree', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to fetch repository files')
        return
      }

      setFiles(data.files)
      setRepoInfo(data.repo)
      setSelectedFiles(data.files.map((f: RepoFile) => f.path))
      setStep('select')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleScan = async () => {
    if (!repoInfo || selectedFiles.length === 0) return

    setScanning(true)
    setError(null)
    setScanProgress(`Scanning ${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''}...`)
    setStep('results')

    try {
      const res = await fetch('/api/scan/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: repoInfo.owner,
          repo: repoInfo.repo,
          files: selectedFiles,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Scan failed')
        return
      }

      setScans(data.scans || [])
      setScanProgress('')
    } catch {
      setError('Network error during scan.')
    } finally {
      setScanning(false)
    }
  }

  const toggleFile = (path: string) => {
    setSelectedFiles(prev =>
      prev.includes(path)
        ? prev.filter(p => p !== path)
        : [...prev, path]
    )
  }

  const toggleAll = () => {
    if (selectedFiles.length === files.length) {
      setSelectedFiles([])
    } else {
      setSelectedFiles(files.map(f => f.path))
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav />
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Scan from GitHub</h1>
          <p className="mt-2 text-gray-600">
            Paste a public GitHub repository URL to scan its markdown skill files for security issues.
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

        {/* Step 1: URL Input */}
        {step === 'url' && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Repository URL</h2>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo"
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && url.trim()) handleFetchFiles()
                  }}
                />
                <button
                  onClick={handleFetchFiles}
                  disabled={!url.trim() || loading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Fetching...
                    </>
                  ) : (
                    'Fetch Files'
                  )}
                </button>
              </div>
              <p className="mt-3 text-sm text-gray-500">
                Works with public repositories. Set <code className="bg-gray-100 px-1 rounded">GITHUB_TOKEN</code> env var for private repos or higher rate limits.
              </p>
            </div>
          </div>
        )}

        {/* Step 2: File Selection */}
        {step === 'select' && repoInfo && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {repoInfo.owner}/{repoInfo.repo}
                  </h2>
                  <p className="text-sm text-gray-500">
                    Branch: {repoInfo.branch} &middot; {files.length} markdown file{files.length !== 1 ? 's' : ''} found
                  </p>
                </div>
                <button
                  onClick={() => { setStep('url'); setFiles([]); setSelectedFiles([]); setRepoInfo(null); setError(null) }}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Change URL
                </button>
              </div>

              {files.length === 0 ? (
                <p className="text-gray-500">No markdown files found in this repository.</p>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <button
                      onClick={toggleAll}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      {selectedFiles.length === files.length ? 'Deselect All' : 'Select All'}
                    </button>
                    <span className="text-sm text-gray-500">
                      {selectedFiles.length} of {files.length} selected
                    </span>
                  </div>

                  <div className="border rounded-lg divide-y divide-gray-200 max-h-96 overflow-y-auto mb-6">
                    {files.map(file => (
                      <label
                        key={file.path}
                        className={`flex items-center px-4 py-3 cursor-pointer hover:bg-gray-50 ${
                          selectedFiles.includes(file.path) ? 'bg-blue-50' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedFiles.includes(file.path)}
                          onChange={() => toggleFile(file.path)}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="ml-3 flex-1 text-sm text-gray-900 font-mono">{file.path}</span>
                        <span className="ml-2 text-xs text-gray-400">{formatSize(file.size)}</span>
                      </label>
                    ))}
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={handleScan}
                      disabled={selectedFiles.length === 0}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Scan {selectedFiles.length} File{selectedFiles.length !== 1 ? 's' : ''}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Results */}
        {step === 'results' && (
          <div className="space-y-6">
            {scanning && (
              <div className="bg-white shadow rounded-lg px-4 py-5 sm:p-6">
                <div className="flex items-center">
                  <svg className="animate-spin h-5 w-5 text-blue-600 mr-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-gray-700">{scanProgress}</span>
                </div>
              </div>
            )}

            {!scanning && scans.length > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Scan Results ({scans.length} file{scans.length !== 1 ? 's' : ''})
                  </h2>
                  <button
                    onClick={() => { setStep('url'); setScans([]); setFiles([]); setSelectedFiles([]); setRepoInfo(null); setError(null) }}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Scan Another Repo
                  </button>
                </div>

                <div className="bg-white shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <div className="space-y-4">
                      {scans.map(scan => (
                        <div key={scan.id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h3 className="font-medium text-gray-900">{scan.skill.name}</h3>
                              <p className="text-sm text-gray-500">
                                {scan.skill.file_path}
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
              </>
            )}

            {!scanning && scans.length === 0 && !error && (
              <div className="bg-white shadow rounded-lg px-4 py-5 sm:p-6 text-center text-gray-500">
                No results to display.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
