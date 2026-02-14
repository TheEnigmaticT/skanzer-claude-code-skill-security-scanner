'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { FindingCategory, SeverityLevel } from '@/lib/types'
import AppNav from '@/app/components/app-nav'

type DetectionRule = {
  id: string
  name: string
  description?: string
  category: FindingCategory
  severity: SeverityLevel
  pattern: string
  enabled: boolean
  created_at: string
  updated_at: string
}

export default function SettingsPage() {
  const [rules, setRules] = useState<DetectionRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    async function fetchRules() {
      const { data, error } = await supabase
        .from('detection_rules')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        setError(error.message)
      } else {
        setRules(data || [])
      }
      setLoading(false)
    }

    fetchRules()
  }, [supabase])

  const toggleEnabled = async (ruleId: string, currentEnabled: boolean) => {
    const newEnabled = !currentEnabled
    const { error } = await supabase
      .from('detection_rules')
      .update({ enabled: newEnabled })
      .eq('id', ruleId)

    if (error) {
      console.error('Failed to update rule:', error)
    } else {
      setRules(prev => prev.map(rule =>
        rule.id === ruleId ? { ...rule, enabled: newEnabled } : rule
      ))
    }
  }

  const getSeverityColor = (severity: SeverityLevel) => {
    switch (severity) {
      case 'low': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'critical': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getCategoryColor = (category: FindingCategory) => {
    switch (category) {
      case 'data_exfiltration': return 'bg-red-100 text-red-800'
      case 'behavior_mismatch': return 'bg-yellow-100 text-yellow-800'
      case 'privilege_escalation': return 'bg-orange-100 text-orange-800'
      case 'other': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-center">
          <p className="font-mono text-sm text-brand-muted">Loading...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-red-700 text-sm" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      <AppNav />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="font-mono text-2xl font-bold text-brand-text">Detection Rules Configuration</h1>
        <p className="mt-2 text-brand-muted">
          Manage static analysis patterns used to identify potential security issues in skills.
          Enable or disable rules to customize the scanning behavior.
        </p>
      </div>

      <div className="bg-brand-surface border border-brand-border">
        <table className="min-w-full divide-y divide-brand-border">
          <thead className="bg-brand-bg">
            <tr>
              <th scope="col" className="px-6 py-3 text-left font-mono text-xs text-brand-muted">
                Name
              </th>
              <th scope="col" className="px-6 py-3 text-left font-mono text-xs text-brand-muted">
                Description
              </th>
              <th scope="col" className="px-6 py-3 text-left font-mono text-xs text-brand-muted">
                Category
              </th>
              <th scope="col" className="px-6 py-3 text-left font-mono text-xs text-brand-muted">
                Severity
              </th>
              <th scope="col" className="px-6 py-3 text-left font-mono text-xs text-brand-muted">
                Pattern
              </th>
              <th scope="col" className="px-6 py-3 text-left font-mono text-xs text-brand-muted">
                Enabled
              </th>
            </tr>
          </thead>
          <tbody className="bg-brand-surface divide-y divide-brand-border">
            {rules.map((rule) => (
              <tr key={rule.id} className="hover:bg-brand-bg">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-brand-text">{rule.name}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-brand-muted max-w-xs truncate" title={rule.description || ''}>
                    {rule.description || '-'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getCategoryColor(rule.category)}`}>
                    {rule.category.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getSeverityColor(rule.severity)}`}>
                    {rule.severity}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-brand-muted font-mono max-w-xs truncate" title={rule.pattern}>
                    {rule.pattern}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={rule.enabled}
                      onChange={() => toggleEnabled(rule.id, rule.enabled)}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-accent-mid rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-accent"></div>
                    <span className="ml-3 text-sm font-medium text-brand-text">
                      {rule.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rules.length === 0 && (
          <div className="text-center py-8 text-brand-muted">
            No detection rules configured.
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
