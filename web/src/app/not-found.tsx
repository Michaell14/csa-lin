import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="card flex w-full max-w-md flex-col gap-4 p-6">
        <div>
          <h1 className="heading text-2xl">There&apos;s nothing here.</h1>
          <p className="mt-2 text-sm text-ink-body">That page doesn&apos;t exist. Lins and people are all reached from the home page.</p>
        </div>
        <Link href="/" className="btn-primary self-start">Go home</Link>
      </div>
    </main>
  )
}
