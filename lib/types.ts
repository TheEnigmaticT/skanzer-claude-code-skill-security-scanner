export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical'
export type ScanStatus = 'pending' | 'scanning' | 'completed' | 'failed'
export type FindingCategory = 'data_exfiltration' | 'behavior_mismatch' | 'privilege_escalation' | 'other'

export interface Skill {
  id: string
  user_id: string
  name: string
  description?: string
  content: string
  file_path?: string
  created_at: string
  updated_at: string
}

export interface Scan {
  id: string
  skill_id: string
  status: ScanStatus
  started_at: string
  completed_at?: string
  error_message?: string
}

export interface Finding {
  id: string
  scan_id: string
  skill_id: string
  category: FindingCategory
  severity: SeverityLevel
  title: string
  description: string
  line_number?: number
  code_snippet?: string
  confidence?: number
  created_at: string
}

export interface ScanWithDetails extends Scan {
  skill: Skill
  findings: Finding[]
}

export interface DashboardStats {
  totalSkills: number
  totalScans: number
  safeSkills: number
  unsafeSkills: number
  findingsBySeverity: Record<SeverityLevel, number>
  findingsByCategory: Record<FindingCategory, number>
}
