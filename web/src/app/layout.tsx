import type { Metadata } from 'next'
import { Source_Sans_3, Source_Serif_4 } from 'next/font/google'
import './globals.css'
import { ViewerProvider } from '@/lib/viewer'

const sourceSans = Source_Sans_3({ subsets: ['latin'], weight: ['400', '500', '600'], style: ['normal', 'italic'], variable: '--font-source-sans' })
const sourceSerif = Source_Serif_4({ subsets: ['latin'], weight: ['600'], variable: '--font-source-serif' })

export const metadata: Metadata = { title: 'CSA Lins', description: 'Big/little family trees of the Penn Chinese Students\' Association' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sourceSans.variable} ${sourceSerif.variable}`}>
      <body className="min-h-dvh bg-paper font-sans text-ink antialiased">
        <ViewerProvider>{children}</ViewerProvider>
      </body>
    </html>
  )
}
