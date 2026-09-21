'use client'
import { useEffect } from 'react'

// Catches a render error anywhere under the root layout, so a broken screen
// shows a way back instead of the framework's own failure page. Errors are
// reported nowhere yet, so the console is the only trace.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="card flex w-full max-w-md flex-col gap-4 p-6">
        <div>
          <h1 className="heading text-2xl">Something went wrong.</h1>
          <p className="mt-2 text-sm text-ink-body">This screen hit an error it could not recover from. Trying again usually fixes it; if it keeps happening, tell a CSA board member.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={reset} className="btn-primary">Try again</button>
          {/* A full page load, not the router: the state that failed is left behind. */}
          <button onClick={() => window.location.assign('/')} className="btn-secondary">Go home</button>
        </div>
      </div>
    </main>
  )
}
