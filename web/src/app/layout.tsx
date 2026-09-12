import type { Metadata } from 'next'
import { Manrope, Syne } from 'next/font/google'
import './globals.css'
import { ViewerProvider } from '@/lib/viewer'

const syne = Syne({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-syne' })
const manrope = Manrope({ subsets: ['latin'], weight: ['500', '700'], variable: '--font-manrope' })

export const metadata: Metadata = { title: 'CSA Lins', description: 'Big/little family trees of the Penn Chinese Students\' Association' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${manrope.variable}`}>
      <body className="min-h-screen bg-cream font-sans text-ink antialiased">
        <ViewerProvider>{children}</ViewerProvider>
      </body>
    </html>
  )
}
