import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Finding, FindingCategory, SeverityLevel, Scan, Skill } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const name = formData.get('name') as string | null
    const description = formData.get('description') as string | null

    // Validate input
    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      )
    }

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Skill name is required' },
        { status: 400 }
      )
    }

    // Read file content
    const content = await file.text()
    if (content.length === 0) {
      return NextResponse.json(
        { error: 'File is empty' },
        { status: 400 }
      )
    }

    // Create skill record
    const { data: skill, error: skillError } = await supabase
      .from('skills')
      .insert({
        user_id: user.id,
        name: name.trim(),
        description: description?.trim() || null,
        content,
        file_path: null // We're storing content directly, not in storage
      })
      .select()
      .single()

    if (skillError) {
      return NextResponse.json(
        { error: 'Failed to create skill', details: skillError.message },
        { status: 500 }
      )
    }

    // Create scan record
    const { data: scan, error: scanError } = await supabase
      .from('scans')
      .insert({
        skill_id: skill.id,
        status: 'scanning',
        started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (scanError) {
      // Clean up skill if scan creation fails
      await supabase.from('skills').delete().eq('id', skill.id)
      return NextResponse.json(
        { error: 'Failed to create scan', details: scanError.message },
        { status: 500 }
      )
    }

    // Perform static analysis
    const findings = analyzeSkillContent(content, skill.id, scan.id)

    // Insert findings
    if (findings.length > 0) {
      const { error: findingsError } = await supabase
        .from('findings')
        .insert(findings)

      if (findingsError) {
        // Update scan with error but don't fail the whole request
        await supabase
          .from('scans')
          .update({
            status: 'failed',
            error_message: 'Failed to save findings: ' + findingsError.message,
            completed_at: new Date().toISOString()
          })
          .eq('id', scan.id)
      }
    }

    // Update scan status to completed
    await supabase
      .from('scans')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', scan.id)

    // Return scan with details
    const { data: scanWithDetails } = await supabase
      .from('scans')
      .select(`
        *,
        skill:skills(*),
        findings:findings(*)
      `)
      .eq('id', scan.id)
      .single()

    return NextResponse.json(
      scanWithDetails,
      { status: 200 }
    )

  } catch (error) {
    console.error('Scan file error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function analyzeSkillContent(
  content: string, 
  skillId: string, 
  scanId: string
): Omit<Finding, 'id' | 'created_at'>[] {
  const findings: Omit<Finding, 'id' | 'created_at'>[] = []
  const lines = content.split('\n')
  
  // Patterns to detect
  const patterns = [
    // Data exfiltration patterns
    {
      regex: /(https?:\/\/|fetch\(|axios\.|curl\s+|wget\s+)/i,
      category: 'data_exfiltration' as FindingCategory,
      severity: 'medium' as SeverityLevel,
      title: 'Network communication detected',
      description: 'The skill contains network calls which could be used for data exfiltration.'
    },
    {
      regex: /(process\.env|os\.getenv|getenv\()/i,
      category: 'data_exfiltration' as FindingCategory,
      severity: 'high' as SeverityLevel,
      title: 'Environment variable access',
      description: 'The skill accesses environment variables which may contain sensitive information.'
    },
    {
      regex: /(writeFile|fs\.writeFile|open\s*\(.*['"]w|>\s*[^>]+)/i,
      category: 'data_exfiltration' as FindingCategory,
      severity: 'high' as SeverityLevel,
      title: 'File write operation',
      description: 'The skill writes to files which could be used to exfiltrate data.'
    },
    // Privilege escalation patterns
    {
      regex: /(sudo\s+|su\s+|\$\(|\`)/i,
      category: 'privilege_escalation' as FindingCategory,
      severity: 'high' as SeverityLevel,
      title: 'Privilege escalation attempt',
      description: 'The skill uses sudo, su, or command substitution which could lead to privilege escalation.'
    },
    {
      regex: /(chmod\s+|chown\s+|setuid|setgid)/i,
      category: 'privilege_escalation' as FindingCategory,
      severity: 'high' as SeverityLevel,
      title: 'Permission modification',
      description: 'The skill modifies file permissions which could be used for privilege escalation.'
    },
    // Behavior mismatch patterns (basic heuristics)
    {
      regex: /(rm\s+-rf|dd\s+|mkfs|format\s+)/i,
      category: 'behavior_mismatch' as FindingCategory,
      severity: 'critical' as SeverityLevel,
      title: 'Destructive operation',
      description: 'The skill contains potentially destructive commands that may not match a typical skill description.'
    },
    {
      regex: /(nc\s+-[el]|netcat\s+-[el]|socat\s+)/i,
      category: 'behavior_mismatch' as FindingCategory,
      severity: 'high' as SeverityLevel,
      title: 'Network listener',
      description: 'The skill sets up network listeners which may indicate unexpected behavior.'
    }
  ]

  // Check each line for patterns
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    for (const pattern of patterns) {
      if (pattern.regex.test(line)) {
        findings.push({
          scan_id: scanId,
          skill_id: skillId,
          category: pattern.category,
          severity: pattern.severity,
          title: pattern.title,
          description: pattern.description,
          line_number: i + 1,
          code_snippet: line.length > 100 ? line.substring(0, 100) + '...' : line,
          confidence: 0.9 // High confidence for exact pattern matches
        })
      }
    }
  }

  return findings
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to upload a file.' },
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
