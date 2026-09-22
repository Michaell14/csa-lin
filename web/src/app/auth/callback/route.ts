import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { RETURN_PARAM, loginErrorUrl, safeReturnPath } from '@/lib/returnPath'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // Only a path on this site is followed; anything else lands on the home page.
  const back = safeReturnPath(searchParams.get(RETURN_PARAM))
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${back}`)
    // The provider's wording stays in the server log; the visitor gets a fixed
    // message for the code, so nothing from the URL is ever shown as ours.
    console.warn('auth callback: code exchange failed:', error.message)
    return NextResponse.redirect(`${origin}${loginErrorUrl('exchange', back)}`)
  }
  const providerError = searchParams.get('error')
  console.warn('auth callback: no code:', providerError, searchParams.get('error_description'))
  return NextResponse.redirect(`${origin}${loginErrorUrl(providerError === 'access_denied' ? 'cancelled' : 'failed', back)}`)
}
