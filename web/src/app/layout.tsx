import type { Metadata, Viewport } from 'next'
import { Fraunces, Instrument_Sans, Source_Sans_3 } from 'next/font/google'
import './globals.css'
import { ViewerProvider } from '@/lib/viewer'
import { Analytics } from '@vercel/analytics/next'

// Both are variable fonts. Fraunces also carries its optical-size and "soft"
// axes: the heading class rounds it off with SOFT, so it reads warm rather
// than editorial at every size.
const instrumentSans = Instrument_Sans({ subsets: ['latin'], weight: 'variable', style: ['normal', 'italic'], variable: '--font-instrument-sans' })
const fraunces = Fraunces({ subsets: ['latin'], weight: 'variable', axes: ['SOFT', 'opsz'], variable: '--font-fraunces' })
// People's names on the tree keep the original face: at 14px in a pill it
// sets a little narrower and rounder than Instrument Sans. Regular for the
// name, medium when selected, italic for a hidden person.
const sourceSans = Source_Sans_3({ subsets: ['latin'], weight: ['400', '500'], style: ['normal', 'italic'], variable: '--font-source-sans' })

const description = "Big/little family trees of the Penn Chinese Students' Association"

// Absolute URLs for the social card come from the production site, so a link
// pasted into a group chat previews the same wherever it was copied.
export const metadata: Metadata = {
  metadataBase: new URL('https://lins.upenncsa.com'),
  title: 'CSA Lins',
  description,
  applicationName: 'CSA Lins',
  openGraph: { title: 'CSA Lins', description, siteName: 'CSA Lins', type: 'website', locale: 'en_US', url: '/' },
  twitter: { card: 'summary_large_image', title: 'CSA Lins', description },
  appleWebApp: { title: 'Lins', statusBarStyle: 'default' },
}

export const viewport: Viewport = { themeColor: '#faf7f2' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${instrumentSans.variable} ${fraunces.variable} ${sourceSans.variable}`}>
      <body className="min-h-dvh bg-paper font-sans text-ink antialiased">
        <ViewerProvider>{children}</ViewerProvider>
        <Analytics />
      </body>
    </html>
  )
}
