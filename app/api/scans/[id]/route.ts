import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ScanWithDetails, SeverityLevel, ScanStatus } from '@/lib/types'
import { SCAN_STATUS_VALUES } from '@/lib/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { id } = await params

    // Fetch scan with skill and findings
    const { data: scan, error } = await supabase
      .from('scans')
      .select(`
        *,
        skill:skills (*),
        findings:findings (*)
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !scan) {
      return NextResponse.json({ error: 'Scan not found' }, { status: 404 })
    }

    // Compute severity breakdown
    const findings = scan.findings as any[]
    const severityBreakdown: Record<SeverityLevel, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    }
    findings.forEach(finding => {
      const severity = finding.severity as SeverityLevel
      if (severityBreakdown[severity] !== undefined) {
        severityBreakdown[severity]++
      }
    })

    const scanWithDetails: ScanWithDetails = {
      ...scan,
      skill: scan.skill as any,
      findings: findings as any
    }

    return NextResponse.json({
      scan: scanWithDetails,
      severityBreakdown
    })
  } catch (error) {
    console.error('Error fetching scan:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    // Validate allowed fields
    const allowedFields = ['status', 'error_message', 'completed_at']
    const updates: any = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'status') {
          if (!SCAN_STATUS_VALUES.includes(body[field] as any)) {
            return NextResponse.json(
              { error: `Invalid status. Must be one of: ${SCAN_STATUS_VALUES.join(', ')}` },
              { status: 400 }
            )
          }
          updates[field] = body[field]
        } else {
          updates[field] = body[field]
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    // Update scan
    const { data: updatedScan, error } = await supabase
      .from('scans')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error || !updatedScan) {
      if (error?.code === 'PGRST116') {
        return NextResponse.json({ error: 'Scan not found' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Failed to update scan' }, { status: 500 })
    }

    return NextResponse.json(updatedScan)
  } catch (error) {
    console.error('Error updating scan:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { id } = await params

    // Delete scan (cascade should handle findings)
    const { error } = await supabase
      .from('scans')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Scan not found' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Failed to delete scan' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Scan deleted successfully' })
  } catch (error) {
    console.error('Error deleting scan:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}
