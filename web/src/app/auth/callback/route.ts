import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { RETURN_PARAM, safeReturnPath } from '@/lib/returnPath'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const described = searchParams.get('error_description')
  // Only a path on this site is followed; anything else lands on the home page.
  const back = safeReturnPath(searchParams.get(RETURN_PARAM))
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${back}`)
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`)
  }
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(described ?? 'Sign-in failed')}`)
}
