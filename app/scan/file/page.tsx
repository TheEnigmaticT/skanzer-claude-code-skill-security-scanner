'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppNav from '@/app/components/app-nav'

export default function UploadSkillFilePage() {
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scanId, setScanId] = useState<string | null>(null)
  const router = useRouter()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError('Please select a file')
      return
    }
    if (!name.trim()) {
      setError('Please enter a name for the skill')
      return
    }

    setUploading(true)
    setError(null)

    try {
      const supabase = createClient()

      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        setError('You must be logged in to upload a skill')
        setUploading(false)
        return
      }

      // Read file content
      const fileContent = await file.text()

      // Insert skill
      const { data: skill, error: skillError } = await supabase
        .from('skills')
        .insert({
          user_id: session.user.id,
          name: name.trim(),
          description: description.trim() || null,
          content: fileContent,
          file_path: file.name,
        })
        .select()
        .single()

      if (skillError) {
        throw new Error(skillError.message)
      }

      // Insert scan
      const { data: scan, error: scanError } = await supabase
        .from('scans')
        .insert({
          skill_id: skill.id,
          status: 'pending',
        })
        .select()
        .single()

      if (scanError) {
        throw new Error(scanError.message)
      }

      setScanId(scan.id)
    } catch (err: any) {
      setError(err.message || 'An error occurred during upload')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      <AppNav />
      <div className="py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="font-mono text-2xl font-bold text-brand-text">Upload Skill File</h1>
          <p className="mt-2 text-brand-muted">
            Upload a Claude Code skill markdown file for security analysis.
          </p>
        </div>

        <div className="bg-brand-surface border border-brand-border p-6">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {scanId ? (
            <div className="text-center">
              <div className="mb-4">
                <svg className="mx-auto h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="font-mono text-lg font-medium text-brand-text">Upload Successful</h3>
              <p className="mt-2 text-brand-muted">
                Your skill has been uploaded and scan has been initiated.
              </p>
              <div className="mt-6">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="font-mono text-sm font-bold bg-brand-accent text-white hover:bg-brand-accent-hover transition-colors px-4 py-2"
                >
                  Go to Dashboard
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="file" className="block text-sm font-medium text-brand-muted">
                  Skill File (Markdown)
                </label>
                <div className="mt-1">
                  <input
                    id="file"
                    name="file"
                    type="file"
                    accept=".md,.markdown"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-brand-muted file:mr-4 file:py-2 file:px-4 file:border-0 file:text-sm file:font-medium file:bg-brand-accent-light file:text-brand-accent hover:file:bg-blue-100"
                  />
                </div>
                <p className="mt-2 text-sm text-brand-muted">
                  Upload a Claude Code skill markdown file. The file will be analyzed for security issues.
                </p>
              </div>

              <div>
                <label htmlFor="name" className="block text-sm font-medium text-brand-muted">
                  Skill Name
                </label>
                <div className="mt-1">
                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="block w-full border border-brand-border py-2 px-3 focus:border-brand-accent focus:outline-none sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-brand-muted">
                  Description (Optional)
                </label>
                <div className="mt-1">
                  <textarea
                    id="description"
                    name="description"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="block w-full border border-brand-border py-2 px-3 focus:border-brand-accent focus:outline-none sm:text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={uploading}
                  className="inline-flex justify-center py-2 px-4 border border-transparent font-mono text-sm font-bold bg-brand-accent text-white hover:bg-brand-accent-hover transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <>
                      <span className="font-mono text-sm text-white mr-3">Loading...</span>
                      Uploading...
                    </>
                  ) : (
                    'Upload and Scan'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="mt-8 bg-brand-accent-light border border-brand-accent-mid p-4">
          <h3 className="font-mono text-sm font-medium text-brand-accent">What gets scanned?</h3>
          <ul className="mt-2 text-sm text-brand-accent list-disc list-inside">
            <li>Data exfiltration attempts (HTTP calls, file writes outside workspace, environment variable access)</li>
            <li>Behavior vs description mismatches (actions vs stated purpose)</li>
            <li>Privilege escalation (sudo, dangerous bash commands)</li>
          </ul>
        </div>
      </div>
      </div>
    </div>
  )
}
