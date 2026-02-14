'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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
            <div className="flex items-center gap-1">
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
          <button
            onClick={handleSignOut}
            className="font-mono text-xs text-brand-muted hover:text-brand-text transition-colors"
          >
            sign out
          </button>
        </div>
      </div>
    </nav>
  )
}
