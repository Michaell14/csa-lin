'use client'
// The last resort, for an error in the root layout itself. It renders its own
// <html> and <body> because the layout that normally provides them has failed,
// so the styles it can count on are the ones written inline here.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#faf7f2', color: '#26211c', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
        <main style={{ maxWidth: 420, padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'ui-serif, Georgia, serif', fontSize: 24, margin: '0 0 8px' }}>CSA Lins could not load.</h1>
          <p style={{ color: '#4a433c', fontSize: 14, margin: '0 0 16px' }}>Something broke before the page could draw. Try again, or come back in a moment.</p>
          <button onClick={reset} style={{ height: 40, padding: '0 16px', borderRadius: 6, border: 0, background: '#b5382c', color: '#fff', font: 'inherit', fontWeight: 500, cursor: 'pointer' }}>Try again</button>
        </main>
      </body>
    </html>
  )
}
