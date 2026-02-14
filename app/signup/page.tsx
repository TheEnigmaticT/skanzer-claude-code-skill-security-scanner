'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setError(error.message)
    } else {
      setMessage('Check your email for the confirmation link.')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="block font-mono text-lg font-bold tracking-tight text-brand-text mb-12">
          skanzer
        </Link>

        <h1 className="font-mono text-2xl font-bold text-brand-text mb-8">
          Create account
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block font-mono text-xs font-medium text-brand-muted mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="block w-full px-3 py-2 border border-brand-border bg-brand-surface text-brand-text text-sm focus:outline-none focus:border-brand-accent"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="password" className="block font-mono text-xs font-medium text-brand-muted mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              className="block w-full px-3 py-2 border border-brand-border bg-brand-surface text-brand-text text-sm focus:outline-none focus:border-brand-accent"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-red-700">{error}</p>
          )}

          {message && (
            <p className="text-sm text-brand-accent font-medium">{message}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full font-mono text-sm font-bold bg-brand-accent text-white py-2.5 hover:bg-brand-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating account...' : 'Sign up'}
          </button>

          <p className="text-sm text-brand-muted text-center">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-brand-accent hover:text-brand-accent-hover">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
