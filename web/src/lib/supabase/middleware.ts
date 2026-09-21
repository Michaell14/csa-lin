import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { RETURN_PARAM, loginUrlFor, safeReturnPath } from '@/lib/returnPath'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname
  const isPublic = path.startsWith('/login') || path.startsWith('/auth')

  // A signed-out visitor is sent to sign in with the page they asked for
  // recorded, so a shared link to a lin or a person survives the round trip.
  if (!user && !isPublic) {
    return NextResponse.redirect(new URL(loginUrlFor(path, request.nextUrl.search), request.url))
  }
  if (user && path.startsWith('/login')) {
    return NextResponse.redirect(new URL(safeReturnPath(request.nextUrl.searchParams.get(RETURN_PARAM)), request.url))
  }
  return response
}
