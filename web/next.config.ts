import type { NextConfig } from "next";

// Every request to Supabase (auth, data, storage) goes to this one origin, so
// it is the only outside host the page may talk to or load media from.
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : ''
const dev = process.env.NODE_ENV === 'development'

// What the page may load and connect to. Next needs inline scripts and styles
// (a nonce would force every page to render per request), so those stay
// allowed; the value of the policy is in the rest: no plugins, no framing, no
// form posts or connections to anywhere but this site and Supabase. HTTPS is
// Vercel's job (and HSTS below keeps it that way), so nothing here upgrades
// requests: a local production build still talks to Supabase over plain HTTP.
const contentSecurityPolicy = [
  "default-src 'self'",
  // Vercel Analytics loads its script from the same origin in production and
  // from its own host in development; the dev server also needs eval for
  // source maps and hot reloading.
  `script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  // Photos and memory media are signed Supabase Storage URLs; blob: is the
  // photo cropper's preview and the PNG export.
  `img-src 'self' data: blob: ${supabaseOrigin}`,
  `media-src 'self' blob: ${supabaseOrigin}`,
  `connect-src 'self' ${supabaseOrigin} https://va.vercel-scripts.com https://vitals.vercel-insights.com${dev ? ' ws: wss:' : ''}`,
  "font-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
]

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
};

export default nextConfig;
