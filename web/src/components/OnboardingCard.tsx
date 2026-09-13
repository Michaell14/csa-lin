'use client'
import { useEffect, useMemo, useState } from 'react'
import { usePersonDetails } from '@/lib/hooks/usePersonDetails'

const DISMISSED_KEY = 'lins.onboarding.dismissed'

export function OnboardingCard({ personId, onOpenProfile }: { personId: string; onOpenProfile: () => void }) {
  const details = usePersonDetails(personId, true)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    try { setDismissed(window.localStorage.getItem(DISMISSED_KEY) === 'true') }
    catch { setDismissed(false) }
  }, [])

  const tasks = useMemo(() => {
    const p = details.person
    if (!p) return []
    return [
      { label: 'Add a profile photo', done: Boolean(p.photo_path) },
      { label: 'Introduce yourself with a short bio', done: Boolean(p.bio?.trim()) },
      { label: 'Add a personal email for after graduation', done: Boolean(p.personal_email) },
      { label: 'Check that your bigs and littles are recorded', done: details.bigs.length + details.littles.length > 0 },
      { label: 'Review pending family requests', done: details.incoming.length === 0, attention: details.incoming.length > 0 },
    ]
  }, [details.person, details.bigs.length, details.littles.length, details.incoming.length])

  if (dismissed || details.loading || !details.person) return null
  const remaining = tasks.filter(task => !task.done)
  if (remaining.length === 0) return null

  function dismiss() {
    setDismissed(true)
    try { window.localStorage.setItem(DISMISSED_KEY, 'true') } catch { /* storage unavailable */ }
  }

  return (
    <section aria-label="Finish setting up your lin profile" className="absolute left-4 top-4 z-10 w-[min(22rem,calc(100%-2rem))] rounded-xl border bg-white/95 p-4 shadow-lg backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Welcome to your lin</p>
          <p className="mt-0.5 text-sm text-neutral-600">A few quick steps will help your family recognize and stay connected with you.</p>
        </div>
        <button onClick={dismiss} aria-label="Dismiss setup checklist" className="rounded px-1.5 text-lg leading-6 text-neutral-500 hover:bg-neutral-100">×</button>
      </div>
      <ul className="mt-3 space-y-1.5 text-sm">
        {tasks.map(task => (
          <li key={task.label} className={`flex gap-2 ${task.done ? 'text-neutral-400' : 'text-neutral-800'}`}>
            <span aria-hidden>{task.done ? '✓' : task.attention ? '!' : '○'}</span>
            <span className={task.done ? 'line-through' : ''}>{task.label}</span>
          </li>
        ))}
      </ul>
      <button onClick={onOpenProfile} className="mt-3 w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700">
        Continue setup · {remaining.length} left
      </button>
    </section>
  )
}
