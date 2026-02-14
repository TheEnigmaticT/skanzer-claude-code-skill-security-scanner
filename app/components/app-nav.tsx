'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

const navItems = [
  { href: '/dashboard', label: 'dashboard' },
  { href: '/scan/file', label: 'file' },
  { href: '/scan/directory', label: 'directory' },
  { href: '/scan/github', label: 'github' },
  { href: '/history', label: 'history' },
  { href: '/settings', label: 'settings' },
]

export default function AppNav() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <nav className="bg-brand-surface border-b border-brand-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-mono text-lg font-bold tracking-tight text-brand-text">
              skanzer
            </Link>
            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-1.5 font-mono text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-brand-accent-light text-brand-accent'
                        : 'text-brand-muted hover:text-brand-text hover:bg-brand-accent-light/50'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleSignOut}
              className="hidden md:block font-mono text-xs text-brand-muted hover:text-brand-text transition-colors"
            >
              sign out
            </button>
            {/* Mobile menu button */}
            <button
              onClick={() => setOpen(!open)}
              className="md:hidden font-mono text-xs text-brand-muted hover:text-brand-text p-1"
              aria-label="Toggle menu"
            >
              {open ? 'close' : 'menu'}
            </button>
          </div>
        </div>
      </div>
      {/* Mobile dropdown */}
      {open && (
        <div className="md:hidden border-t border-brand-border bg-brand-surface px-4 py-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`block px-3 py-2 font-mono text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-accent-light text-brand-accent'
                    : 'text-brand-muted hover:text-brand-text hover:bg-brand-accent-light/50'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
          <button
            onClick={handleSignOut}
            className="block w-full text-left px-3 py-2 font-mono text-sm text-brand-muted hover:text-brand-text transition-colors"
          >
            sign out
          </button>
        </div>
      )}
    </nav>
  )
}
