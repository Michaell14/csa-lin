import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  // Everything except static assets and the files a browser, a link preview or
  // a home-screen install fetches without a session: the manifest, the icons
  // and the social-card images Next serves from the app folder without an extension.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon|apple-icon|opengraph-image|twitter-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)'],
}
