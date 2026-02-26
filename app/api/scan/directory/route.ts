import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { analyzeSkillContent } from '@/lib/analyze'
import { checkScanCreationRate, rateLimitResponse } from '@/lib/rate-limit'
import type { Scan } from '@/lib/types'

const DIRECTORY_RATE_LIMIT = 1000 // scans per hour via directory re-scan

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const admin = createServiceClient()

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

  // Rate limit: 1000 directory re-scans per hour
  const rateCheck = await checkScanCreationRate(user.id, DIRECTORY_RATE_LIMIT)
  if (!rateCheck.allowed) {
    return NextResponse.json(rateLimitResponse(rateCheck), { status: 429 })
  }

  if (rateCheck.current + uniqueSkillIds.length > DIRECTORY_RATE_LIMIT) {
    return NextResponse.json({
      error: 'Rate limit exceeded',
      message: `This batch of ${uniqueSkillIds.length} skills would exceed your hourly limit. You have ${rateCheck.remaining} scans remaining this hour.`,
      limit: DIRECTORY_RATE_LIMIT,
      current: rateCheck.current,
      remaining: rateCheck.remaining,
    }, { status: 429 })
  }

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
    const { data: scan, error: scanError } = await admin
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
        const { error: findingsError } = await admin
          .from('findings')
          .insert(findings)

        if (findingsError) {
          throw findingsError
        }
      }

      // Update scan to completed
      const { error: updateError } = await admin
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
      await admin
        .from('scans')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error during analysis'
        })
        .eq('id', scan.id)
    }
  }

  // Fetch all created scans with details (skill and findings)
  const { data: scansWithDetails, error: fetchError } = await admin
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
