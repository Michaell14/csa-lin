'use client'
import { useEffect, useMemo, useState } from 'react'
import type { PersonDetails } from '@/lib/hooks/usePersonDetails'

// Scoped per person: several accounts can sign in from the same browser, and one
// person dismissing their checklist must not hide the next person's.
const dismissedKey = (personId: string) => `lins.onboarding.dismissed.${personId}`

// `details` is the page's single copy of the viewer's profile, shared with the
// side panel. Editing there reloads that copy, so the checklist ticks tasks off
// as they are finished instead of waiting for a page reload.
export function OnboardingCard({ personId, details, onOpenProfile }: { personId: string; details: PersonDetails; onOpenProfile: () => void }) {
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    try { setDismissed(window.localStorage.getItem(dismissedKey(personId)) === 'true') }
    catch { setDismissed(false) }
  }, [personId])

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
    try { window.localStorage.setItem(dismissedKey(personId), 'true') } catch { /* storage unavailable */ }
  }

  return (
    <section aria-label="Finish setting up your lin profile" className="card absolute left-3 top-3 z-10 hidden w-[min(22rem,calc(100%-1.5rem))] p-4 shadow-md sm:block">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="heading text-sm">Welcome to your lin</p>
          <p className="mt-0.5 text-sm text-ink-body">A few quick steps will help your family recognize and stay connected with you.</p>
        </div>
        <button onClick={dismiss} aria-label="Dismiss setup checklist" className="rounded px-1.5 text-lg leading-6 text-ink-muted hover:bg-surface-hover">×</button>
      </div>
      <ul className="mt-3 space-y-1.5 text-sm">
        {tasks.map(task => (
          <li key={task.label} className={`flex gap-2 ${task.done ? 'text-ink-muted' : 'text-ink'}`}>
            <span aria-hidden className={task.attention && !task.done ? 'text-accent' : ''}>{task.done ? '✓' : task.attention ? '!' : '○'}</span>
            <span className={task.done ? 'line-through' : ''}>{task.label}</span>
          </li>
        ))}
      </ul>
      <button onClick={onOpenProfile} className="btn-primary mt-3 w-full">
        Continue setup · {remaining.length} left
      </button>
    </section>
  )
}
