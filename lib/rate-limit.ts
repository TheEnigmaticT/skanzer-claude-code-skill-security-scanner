import { createServiceClient } from '@/lib/supabase/server'

interface RateLimitResult {
  allowed: boolean
  current: number
  limit: number
  remaining: number
}

/**
 * Check how many skills a user has created in the last hour.
 * Uses the skills table — no new infrastructure needed.
 */
export async function checkSkillCreationRate(
  userId: string,
  limit: number,
  /** Count only skills from a specific source (e.g. 'github:%') or null for non-github */
  filePathPattern: string | null
): Promise<RateLimitResult> {
  const admin = createServiceClient()
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  let query = admin
    .from('skills')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', oneHourAgo)

  if (filePathPattern) {
    query = query.like('file_path', filePathPattern)
  } else {
    // Non-github skills: file_path is null (file uploads)
    query = query.is('file_path', null)
  }

  const { count } = await query
  const current = count || 0

  return {
    allowed: current < limit,
    current,
    limit,
    remaining: Math.max(0, limit - current),
  }
}

/**
 * Check how many scans a user has created in the last hour.
 * Used for the directory re-scan route which doesn't create new skills.
 */
export async function checkScanCreationRate(
  userId: string,
  limit: number
): Promise<RateLimitResult> {
  const admin = createServiceClient()
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  // Count scans created in the last hour for skills owned by this user
  const { count } = await admin
    .from('scans')
    .select('*, skill:skills!inner(user_id)', { count: 'exact', head: true })
    .eq('skill.user_id', userId)
    .gte('started_at', oneHourAgo)

  const current = count || 0

  return {
    allowed: current < limit,
    current,
    limit,
    remaining: Math.max(0, limit - current),
  }
}

/** Standard 429 response body */
export function rateLimitResponse(result: RateLimitResult) {
  return {
    error: 'Rate limit exceeded',
    message: `You've used ${result.current} of ${result.limit} allowed per hour. Try again later.`,
    limit: result.limit,
    current: result.current,
    remaining: result.remaining,
  }
}
