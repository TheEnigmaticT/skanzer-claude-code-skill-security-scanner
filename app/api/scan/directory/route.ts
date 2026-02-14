import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Finding, SeverityLevel, FindingCategory, Scan } from '@/lib/types'

type NewFinding = Omit<Finding, 'id' | 'scan_id' | 'skill_id' | 'created_at'>

function analyzeSkillContent(content: string, skillId: string, scanId: string): NewFinding[] {
  const findings: NewFinding[] = []
  const lines = content.split('\n')

  lines.forEach((line, index) => {
    const lineNum = index + 1
    const trimmedLine = line.trim()

    // Data exfiltration: URLs
    const urlRegex = /https?:\/\/[^\s]+/g
    let match
    while ((match = urlRegex.exec(line)) !== null) {
      findings.push({
        category: 'data_exfiltration' as FindingCategory,
        severity: 'high' as SeverityLevel,
        title: 'Potential data exfiltration via URL',
        description: `URL detected: ${match[0]}`,
        line_number: lineNum,
        code_snippet: trimmedLine,
        confidence: 0.9
      })
    }

    // Environment variable access
    const envRegex = /(?:process\.env|getenv|os\.environ|\$[A-Z_]+)/
    if (envRegex.test(line)) {
      findings.push({
        category: 'data_exfiltration' as FindingCategory,
        severity: 'medium' as SeverityLevel,
        title: 'Environment variable access',
        description: 'Skill accesses environment variables which could leak sensitive data.',
        line_number: lineNum,
        code_snippet: trimmedLine,
        confidence: 0.8
      })
    }

    // Dangerous file operations (writes to sensitive system paths)
    const fileWriteRegex = /(?:write|create|copy|move|mv|cp)\s+.*(?:\/etc\/|\/root\/|\/home\/[^\/]+\/|\/var\/|\/usr\/)/i
    if (fileWriteRegex.test(line)) {
      findings.push({
        category: 'data_exfiltration' as FindingCategory,
        severity: 'high' as SeverityLevel,
        title: 'Potentially dangerous file operation',
        description: 'Skill performs file write to a sensitive system directory.',
        line_number: lineNum,
        code_snippet: trimmedLine,
        confidence: 0.7
      })
    }

    // Privilege escalation
    const privRegex = /(?:sudo|su\s+-|chmod\s+u\+s|setuid|pkexec)/
    if (privRegex.test(line)) {
      findings.push({
        category: 'privilege_escalation' as FindingCategory,
        severity: 'critical' as SeverityLevel,
        title: 'Privilege escalation attempt',
        description: 'Skill uses commands that may elevate privileges.',
        line_number: lineNum,
        code_snippet: trimmedLine,
        confidence: 0.95
      })
    }
  })

  // Behavior mismatch: if content claims to be safe but we found dangerous patterns
  if (findings.length > 0) {
    const contentLower = content.toLowerCase()
    if (contentLower.includes('safe') || contentLower.includes('harmless') || contentLower.includes('no risk')) {
      findings.push({
        category: 'behavior_mismatch' as FindingCategory,
        severity: 'medium' as SeverityLevel,
        title: 'Behavior vs description mismatch',
        description: 'Skill claims to be safe but contains potentially dangerous patterns.',
        confidence: 0.6
      })
    }
  }

  return findings
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  // Parse request body
  let body
  try {
    body = await request.json()
  } catch (e) {
    return NextResponse.json(
      { error: 'Invalid JSON' },
      { status: 400 }
    )
  }

  const { skillIds } = body as { skillIds: string[] }
  if (!skillIds || !Array.isArray(skillIds) || skillIds.length === 0) {
    return NextResponse.json(
      { error: 'skillIds array is required and must not be empty' },
      { status: 400 }
    )
  }

  // Deduplicate skill IDs
  const uniqueSkillIds = [...new Set(skillIds)]

  // Fetch all requested skills belonging to the user
  const { data: skills, error: skillsError } = await supabase
    .from('skills')
    .select('*')
    .in('id', uniqueSkillIds)
    .eq('user_id', user.id)

  if (skillsError) {
    return NextResponse.json(
      { error: 'Failed to fetch skills' },
      { status: 500 }
    )
  }

  // Verify all requested skill IDs were found and belong to user
  const foundIds = new Set(skills.map(s => s.id))
  const missingIds = uniqueSkillIds.filter(id => !foundIds.has(id))
  if (missingIds.length > 0) {
    return NextResponse.json(
      { error: 'Some skills not found or access denied', missingIds },
      { status: 404 }
    )
  }

  const createdScans: Scan[] = []

  // Process each skill
  for (const skill of skills) {
    // Create a new scan record
    const { data: scan, error: scanError } = await supabase
      .from('scans')
      .insert({
        skill_id: skill.id,
        status: 'scanning',
        started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (scanError || !scan) {
      console.error(`Failed to create scan for skill ${skill.id}:`, scanError)
      continue
    }

    try {
      // Analyze skill content
      const findings = analyzeSkillContent(skill.content, skill.id, scan.id)

      // Insert findings if any
      if (findings.length > 0) {
        const findingsToInsert = findings.map(f => ({
          ...f,
          scan_id: scan.id,
          skill_id: skill.id,
          created_at: new Date().toISOString()
        }))

        const { error: findingsError } = await supabase
          .from('findings')
          .insert(findingsToInsert)

        if (findingsError) {
          throw findingsError
        }
      }

      // Update scan to completed
      const { error: updateError } = await supabase
        .from('scans')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', scan.id)

      if (updateError) {
        throw updateError
      }

      createdScans.push(scan)
    } catch (error) {
      // Mark scan as failed
      await supabase
        .from('scans')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error during analysis'
        })
        .eq('id', scan.id)
    }
  }

  // Fetch all created scans with details (skill and findings)
  const { data: scansWithDetails, error: fetchError } = await supabase
    .from('scans')
    .select(`
      *,
      skill:skills (*),
      findings:findings (*)
    `)
    .in('id', createdScans.map(s => s.id))
    .order('started_at', { ascending: false })

  if (fetchError) {
    return NextResponse.json(
      { error: 'Failed to fetch scan results' },
      { status: 500 }
    )
  }

  return NextResponse.json(
    { scans: scansWithDetails },
    { status: 200 }
  )
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to scan a directory.' },
    { status: 405 }
  )
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}
