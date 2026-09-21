import type { Metadata, Viewport } from 'next'
import { Source_Sans_3, Source_Serif_4 } from 'next/font/google'
import './globals.css'
import { ViewerProvider } from '@/lib/viewer'
import { Analytics } from '@vercel/analytics/next'

const sourceSans = Source_Sans_3({ subsets: ['latin'], weight: ['400', '500', '600'], style: ['normal', 'italic'], variable: '--font-source-sans' })
const sourceSerif = Source_Serif_4({ subsets: ['latin'], weight: ['600'], variable: '--font-source-serif' })

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
    <html lang="en" className={`${sourceSans.variable} ${sourceSerif.variable}`}>
      <body className="min-h-dvh bg-paper font-sans text-ink antialiased">
        <ViewerProvider>{children}</ViewerProvider>
        <Analytics />
      </body>
    </html>
  )
}
