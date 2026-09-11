'use client'
import { useState } from 'react'
import type { Link } from '@/lib/types'
import type { Related } from '@/components/panel/ProfileView'

export function describeExisting(link: Link, me: string): string {
  if (link.status === 'confirmed') return 'This link is already confirmed'
  if (link.proposed_by === me) return 'You already requested this link'
  return 'They already requested this link; accept it below'
}

export function LinkRequests({ me, incoming, outgoing, bigs, littles, onAccept, onDecline, onWithdraw, onRemove }: {
  me: string
  incoming: Related[]
  outgoing: Related[]
  bigs: Related[]
  littles: Related[]
  onAccept: (l: Link) => void
  onDecline: (l: Link) => void
  onWithdraw: (l: Link) => void
  onRemove: (l: Link) => void
}) {
  const roleOf = (l: Link) => (l.big_id === me ? 'little' : 'big')
  // Confirm in place: a browser dialog drops you out of the app to ask.
  const [confirming, setConfirming] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-3 text-sm">
      {incoming.length > 0 && (
        <div>
          <p className="text-xs uppercase text-ink-faint">Requests for you</p>
          <ul className="mt-1 flex flex-col gap-1">
            {incoming.map(r => (
              <li key={r.link.id} className="flex items-center gap-2">
                <span>{r.person.display_name} wants to be your {roleOf(r.link)}</span>
                <button onClick={() => onAccept(r.link)} className="ml-auto rounded bg-accent px-2 py-0.5 text-accent-ink">Accept</button>
                <button onClick={() => onDecline(r.link)} className="rounded border px-2 py-0.5">Decline</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {outgoing.length > 0 && (
        <div>
          <p className="text-xs uppercase text-ink-faint">Your requests</p>
          <ul className="mt-1 flex flex-col gap-1">
            {outgoing.map(r => (
              <li key={r.link.id} className="flex items-center gap-2">
                <span>Waiting for {r.person.display_name} to confirm as your {roleOf(r.link)}</span>
                <button onClick={() => onWithdraw(r.link)} className="ml-auto rounded border px-2 py-0.5">Withdraw</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {(bigs.length > 0 || littles.length > 0) && (
        <div>
          <p className="text-xs uppercase text-ink-faint">Remove a link</p>
          <ul className="mt-1 flex flex-wrap gap-1">
            {[...bigs, ...littles].map(r => (
              <li key={r.link.id}>
                {confirming === r.link.id ? (
                  <span className="flex items-center gap-1 rounded border border-danger px-2 py-0.5">
                    <span>Remove {r.person.display_name}?</span>
                    <button onClick={() => { setConfirming(null); onRemove(r.link) }} className="rounded px-1 font-medium text-danger underline">Remove</button>
                    <button onClick={() => setConfirming(null)} className="rounded px-1 underline">Keep</button>
                  </span>
                ) : (
                  <button onClick={() => setConfirming(r.link.id)} aria-label={`Remove ${r.person.display_name}`} className="rounded border px-2 py-0.5 text-ink-muted hover:bg-surface-hover">
                    {r.person.display_name} &times;
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
