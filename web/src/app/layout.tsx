import type { Metadata } from 'next'
import './globals.css'
import { ViewerProvider } from '@/lib/viewer'

export const metadata: Metadata = { title: 'CSA Lins', description: 'Big/little family trees of the Penn Chinese Students\' Association' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white font-sans text-ink antialiased">
        <ViewerProvider>{children}</ViewerProvider>
      </body>
    </html>
  )
}
