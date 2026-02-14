import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function middleware(request: Request) {
  const response = NextResponse.next()
  const supabase = await createClient()

  // Refresh the session if there's a cookie
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // If there's no session and we're trying to access a protected route, redirect to login
  if (!session && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // If there is a session, ensure it's fresh (Supabase client handles this automatically)
  // But we can also set the session cookie if needed
  // The createServerClient already handles cookie refresh

  return response
}

export const config = {
  matcher: [
    // Protect all dashboard routes
    '/dashboard/:path*',
    // Optionally, you could protect other routes
  ],
}
