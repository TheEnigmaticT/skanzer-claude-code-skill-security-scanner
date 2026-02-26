import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { analyzeSkillContent, extractSkillName } from '@/lib/analyze'
import { checkSkillCreationRate, rateLimitResponse } from '@/lib/rate-limit'

const UPLOAD_RATE_LIMIT = 1000 // skills per hour via file upload

export async function POST(request: NextRequest) {
  try {
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

    // Rate limit: 1000 file upload scans per hour
    const rateCheck = await checkSkillCreationRate(user.id, UPLOAD_RATE_LIMIT, null)
    if (!rateCheck.allowed) {
      return NextResponse.json(rateLimitResponse(rateCheck), { status: 429 })
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

    // Use the name from content frontmatter/heading if available, otherwise the user-provided name
    const extractedName = extractSkillName(content)
    const skillName = extractedName || name.trim()

    // Create skill record
    const { data: skill, error: skillError } = await supabase
      .from('skills')
      .insert({
        user_id: user.id,
        name: skillName,
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

    // Create scan record (service role — no RLS update policy on scans)
    const { data: scan, error: scanError } = await admin
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

    // Insert findings (service role — no RLS insert policy on findings)
    if (findings.length > 0) {
      const { error: findingsError } = await admin
        .from('findings')
        .insert(findings)

      if (findingsError) {
        await admin
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
    await admin
      .from('scans')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', scan.id)

    // Return scan with details
    const { data: scanWithDetails } = await admin
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
