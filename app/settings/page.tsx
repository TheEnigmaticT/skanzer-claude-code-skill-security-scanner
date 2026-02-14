'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { FindingCategory, SeverityLevel } from '@/lib/types'

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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Detection Rules Configuration</h1>
        <p className="mt-2 text-gray-600">
          Manage static analysis patterns used to identify potential security issues in skills.
          Enable or disable rules to customize the scanning behavior.
        </p>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Severity
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Pattern
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Enabled
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rules.map((rule) => (
              <tr key={rule.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{rule.name}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-500 max-w-xs truncate" title={rule.description || ''}>
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
                  <div className="text-sm text-gray-500 font-mono max-w-xs truncate" title={rule.pattern}>
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
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    <span className="ml-3 text-sm font-medium text-gray-900">
                      {rule.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rules.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No detection rules configured.
          </div>
        )}
      </div>
    </div>
  )
}
