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

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

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
  const [copied, setCopied] = useState<string | null>(null)
  const [failedFiles, setFailedFiles] = useState<string[]>([])

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

  const scanBatches = async (filesToScan: string[], label: string): Promise<string[]> => {
    if (!repoInfo) return filesToScan

    const BATCH_SIZE = 50
    const chunks = chunkArray(filesToScan, BATCH_SIZE)
    const totalFiles = filesToScan.length
    let filesProcessed = 0
    const failed: string[] = []

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      setScanProgress(
        chunks.length === 1
          ? `${label} ${totalFiles} file${totalFiles !== 1 ? 's' : ''}...`
          : `${label} batch ${i + 1}/${chunks.length} (${filesProcessed + chunk.length} of ${totalFiles} files)...`
      )

      try {
        const res = await fetch('/api/scan/github', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            owner: repoInfo.owner,
            repo: repoInfo.repo,
            branch: repoInfo.branch,
            files: chunk,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          console.error(`Batch ${i + 1} failed:`, data.error)
          failed.push(...chunk)
        } else {
          setScans(prev => [...prev, ...(data.scans || [])])
        }
      } catch (err) {
        console.error(`Batch ${i + 1} network error:`, err)
        failed.push(...chunk)
      }

      filesProcessed += chunk.length
    }

    return failed
  }

  const handleScan = async () => {
    if (!repoInfo || selectedFiles.length === 0) return

    setScanning(true)
    setError(null)
    setScans([])
    setFailedFiles([])
    setStep('results')

    // First pass
    let failed = await scanBatches(selectedFiles, 'Scanning')

    // Auto-retry failed batches once
    if (failed.length > 0 && failed.length < selectedFiles.length) {
      setScanProgress(`Retrying ${failed.length} failed file${failed.length !== 1 ? 's' : ''}...`)
      failed = await scanBatches(failed, 'Retrying')
    }

    if (failed.length > 0) {
      setFailedFiles(failed)
      setError(`${failed.length} file${failed.length !== 1 ? 's' : ''} failed to scan. You can retry them below.`)
    }

    setScanProgress('')
    setScanning(false)
  }

  const handleRetryFailed = async () => {
    if (!repoInfo || failedFiles.length === 0) return

    setScanning(true)
    setError(null)

    const failed = await scanBatches(failedFiles, 'Retrying')

    if (failed.length > 0) {
      setFailedFiles(failed)
      setError(`${failed.length} file${failed.length !== 1 ? 's' : ''} still failing.`)
    } else {
      setFailedFiles([])
    }

    setScanProgress('')
    setScanning(false)
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
    <div className="min-h-screen bg-brand-bg">
      <AppNav />
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="font-mono text-2xl font-bold text-brand-text">Scan from GitHub</h1>
          <p className="mt-2 text-brand-muted">
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
              <div className="ml-3 flex items-center gap-3">
                <p className="text-sm text-red-700">{error}</p>
                {failedFiles.length > 0 && !scanning && (
                  <button
                    onClick={handleRetryFailed}
                    className="shrink-0 px-3 py-1 font-mono text-xs font-bold text-white bg-brand-accent hover:bg-brand-accent-hover transition-colors"
                  >
                    Retry {failedFiles.length} file{failedFiles.length !== 1 ? 's' : ''}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 1: URL Input */}
        {step === 'url' && (
          <div className="bg-brand-surface border border-brand-border">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="font-mono text-lg font-bold text-brand-text mb-4">Repository URL</h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo"
                  className="flex-1 min-w-0 border border-brand-border px-3 py-2 text-sm focus:border-brand-accent focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && url.trim()) handleFetchFiles()
                  }}
                />
                <button
                  onClick={handleFetchFiles}
                  disabled={!url.trim() || loading}
                  className="self-start items-center px-4 py-2 border border-transparent font-mono text-sm font-bold text-white bg-brand-accent hover:bg-brand-accent-hover focus:border-brand-accent focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Fetching...' : 'Fetch Files'}
                </button>
              </div>
              <p className="mt-3 text-sm text-brand-muted">
                Works with public repositories. Set <code className="bg-brand-bg px-1 rounded">GITHUB_TOKEN</code> env var for private repos or higher rate limits.
              </p>
            </div>
          </div>
        )}

        {/* Step 2: File Selection */}
        {step === 'select' && repoInfo && (
          <div className="bg-brand-surface border border-brand-border">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-mono text-lg font-bold text-brand-text">
                    {repoInfo.owner}/{repoInfo.repo}
                  </h2>
                  <p className="text-sm text-brand-muted">
                    Branch: {repoInfo.branch} &middot; {files.length} markdown file{files.length !== 1 ? 's' : ''} found
                  </p>
                </div>
                <button
                  onClick={() => { setStep('url'); setFiles([]); setSelectedFiles([]); setRepoInfo(null); setError(null) }}
                  className="text-sm text-brand-accent hover:text-brand-accent-hover"
                >
                  Change URL
                </button>
              </div>

              {files.length === 0 ? (
                <p className="text-brand-muted">No markdown files found in this repository.</p>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <button
                      onClick={toggleAll}
                      className="text-sm text-brand-accent hover:text-brand-accent-hover"
                    >
                      {selectedFiles.length === files.length ? 'Deselect All' : 'Select All'}
                    </button>
                    <span className="text-sm text-brand-muted">
                      {selectedFiles.length} of {files.length} selected
                    </span>
                  </div>

                  <div className="border border-brand-border divide-y divide-brand-border max-h-96 overflow-y-auto mb-6">
                    {files.map(file => (
                      <label
                        key={file.path}
                        className={`flex items-center px-4 py-3 cursor-pointer hover:bg-brand-bg ${
                          selectedFiles.includes(file.path) ? 'bg-brand-accent-light' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedFiles.includes(file.path)}
                          onChange={() => toggleFile(file.path)}
                          className="h-4 w-4 text-brand-accent border-brand-border rounded focus:border-brand-accent focus:outline-none"
                        />
                        <span className="ml-3 flex-1 text-sm text-brand-text font-mono">{file.path}</span>
                        <span className="ml-2 text-xs text-brand-muted">{formatSize(file.size)}</span>
                      </label>
                    ))}
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={handleScan}
                      disabled={selectedFiles.length === 0}
                      className="inline-flex items-center px-4 py-2 border border-transparent font-mono text-sm font-bold text-white bg-brand-accent hover:bg-brand-accent-hover focus:border-brand-accent focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
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
              <div className="bg-brand-surface border border-brand-border px-4 py-5 sm:p-6">
                <div className="flex items-center">
                  <span className="font-mono text-sm text-brand-muted">{scanProgress}</span>
                </div>
              </div>
            )}

            {scans.length > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="font-mono text-lg font-bold text-brand-text">
                    Scan Results ({scans.length} file{scans.length !== 1 ? 's' : ''})
                  </h2>
                  {!scanning && (
                    <button
                      onClick={() => { setStep('url'); setScans([]); setFiles([]); setSelectedFiles([]); setRepoInfo(null); setError(null) }}
                      className="text-sm text-brand-accent hover:text-brand-accent-hover"
                    >
                      Scan Another Repo
                    </button>
                  )}
                </div>

                {/* Repo Report Link */}
                {repoInfo && (
                  <div className="bg-brand-accent-light border border-brand-accent p-4">
                    <a
                      href={`/repo/${repoInfo.owner}/${repoInfo.repo}`}
                      className="font-mono text-sm font-bold text-brand-accent hover:text-brand-accent-hover break-words"
                    >
                      View Repository Report for {repoInfo.owner}/{repoInfo.repo} &rarr;
                    </a>
                    <p className="text-xs text-brand-muted mt-1">
                      See all skills and findings for this repository in one place.
                    </p>
                  </div>
                )}

                <div className="bg-brand-surface border border-brand-border">
                  <div className="px-4 py-5 sm:p-6">
                    <div className="space-y-4">
                      {scans.map(scan => (
                        <div key={scan.id} className="border border-brand-border p-4">
                          <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                            <div className="min-w-0">
                              <h3 className="font-mono text-base font-bold text-brand-text">{scan.skill.name}</h3>
                              <p className="text-sm text-brand-muted">
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
                                    <div className="flex flex-wrap justify-between items-start gap-2">
                                      <span className="font-medium text-brand-text min-w-0">{finding.title}</span>
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

                {/* Badge Embed Section */}
                {(() => {
                  const completedScans = scans.filter(s => s.status === 'completed')
                  if (completedScans.length === 0 || !repoInfo) return null

                  const repoName = `${repoInfo.owner}/${repoInfo.repo}`
                  const origin = window.location.origin

                  // Repo-level badge (recommended)
                  const repoBadgeUrl = `${origin}/api/badge/repo/${repoInfo.owner}/${repoInfo.repo}`
                  const repoPageUrl = `${origin}/repo/${repoInfo.owner}/${repoInfo.repo}`
                  const repoMdSnippet = `[![Skanzer Security Scan](${repoBadgeUrl})](${repoPageUrl})`
                  const repoHtmlSnippet = `<a href="${repoPageUrl}"><img src="${repoBadgeUrl}" alt="Skanzer Security Scan for ${repoName}"></a>`

                  // Single-scan badge (pick worst scan)
                  const severityRank = { critical: 4, high: 3, medium: 2, low: 1 }
                  const worstScan = completedScans.reduce((worst, scan) => {
                    const worstSev = Math.max(0, ...(scan.findings || []).map(f => severityRank[f.severity] || 0))
                    const currentWorstSev = Math.max(0, ...(worst.findings || []).map(f => severityRank[f.severity] || 0))
                    return worstSev > currentWorstSev ? scan : worst
                  }, completedScans[0])
                  const scanBadgeUrl = `${origin}/api/badge/${worstScan.id}`
                  const scanMdSnippet = `![Skanzer Security Scan](${scanBadgeUrl})`
                  const scanHtmlSnippet = `<img src="${scanBadgeUrl}" alt="Skanzer Security Scan for ${repoName}">`

                  const copyToClipboard = (text: string, label: string) => {
                    navigator.clipboard.writeText(text)
                    setCopied(label)
                    setTimeout(() => setCopied(null), 2000)
                  }

                  return (
                    <div className="bg-brand-surface border border-brand-border">
                      <div className="px-4 py-5 sm:p-6">
                        <h3 className="font-mono text-base font-bold text-brand-text mb-4">Embed Badge</h3>
                        <p className="text-sm text-brand-muted mb-4">
                          Add a badge to your repository README to show its security scan status.
                        </p>

                        {/* Repo Badge (Recommended) */}
                        <div className="mb-6 p-4 border border-brand-accent bg-brand-accent-light">
                          <div className="flex items-center gap-2 mb-3">
                            <h4 className="font-mono text-sm font-bold text-brand-text">Repository Badge</h4>
                            <span className="text-xs font-medium text-brand-accent bg-white px-1.5 py-0.5">Recommended</span>
                          </div>
                          <p className="text-xs text-brand-muted mb-3">
                            Shows aggregate status across all scanned skills. Updates automatically with new scans.
                          </p>
                          <div className="mb-3 p-3 bg-white flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={repoBadgeUrl} alt={`Skanzer Security Scan for ${repoName}`} height={20} />
                          </div>
                          <div className="space-y-2">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-medium text-brand-muted">Markdown</label>
                                <button onClick={() => copyToClipboard(repoMdSnippet, 'repo-md')} className="text-xs text-brand-accent hover:text-brand-accent-hover">
                                  {copied === 'repo-md' ? 'Copied!' : 'Copy'}
                                </button>
                              </div>
                              <pre className="text-xs bg-white p-2 overflow-x-auto select-all"><code>{repoMdSnippet}</code></pre>
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-medium text-brand-muted">HTML</label>
                                <button onClick={() => copyToClipboard(repoHtmlSnippet, 'repo-html')} className="text-xs text-brand-accent hover:text-brand-accent-hover">
                                  {copied === 'repo-html' ? 'Copied!' : 'Copy'}
                                </button>
                              </div>
                              <pre className="text-xs bg-white p-2 overflow-x-auto select-all"><code>{repoHtmlSnippet}</code></pre>
                            </div>
                          </div>
                        </div>

                        {/* Single-Scan Badge */}
                        <div className="p-4 border border-brand-border">
                          <h4 className="font-mono text-sm font-bold text-brand-text mb-3">Single-Scan Badge</h4>
                          <p className="text-xs text-brand-muted mb-3">
                            Shows the result of this specific scan only.
                          </p>
                          <div className="mb-3 p-3 bg-brand-bg flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={scanBadgeUrl} alt={`Skanzer Security Scan for ${repoName}`} height={20} />
                          </div>
                          <div className="space-y-2">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-medium text-brand-muted">Markdown</label>
                                <button onClick={() => copyToClipboard(scanMdSnippet, 'scan-md')} className="text-xs text-brand-accent hover:text-brand-accent-hover">
                                  {copied === 'scan-md' ? 'Copied!' : 'Copy'}
                                </button>
                              </div>
                              <pre className="text-xs bg-brand-bg p-2 overflow-x-auto select-all"><code>{scanMdSnippet}</code></pre>
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-medium text-brand-muted">HTML</label>
                                <button onClick={() => copyToClipboard(scanHtmlSnippet, 'scan-html')} className="text-xs text-brand-accent hover:text-brand-accent-hover">
                                  {copied === 'scan-html' ? 'Copied!' : 'Copy'}
                                </button>
                              </div>
                              <pre className="text-xs bg-brand-bg p-2 overflow-x-auto select-all"><code>{scanHtmlSnippet}</code></pre>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </>
            )}

            {!scanning && scans.length === 0 && !error && (
              <div className="bg-brand-surface border border-brand-border px-4 py-5 sm:p-6 text-center text-brand-muted">
                No results to display.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
