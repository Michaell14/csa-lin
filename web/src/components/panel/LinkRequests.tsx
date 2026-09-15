'use client'
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
  return (
    <div className="flex flex-col gap-4 text-sm">
      {incoming.length > 0 && (
        <div>
          <p className="label">Requests for you</p>
          <ul className="mt-2 flex flex-col gap-2">
            {incoming.map(r => (
              <li key={r.link.id} className="flex flex-wrap items-center gap-2">
                <span>{r.person.display_name} wants to be your {roleOf(r.link)}</span>
                <button onClick={() => onAccept(r.link)} className="btn-sm-primary ml-auto">Accept</button>
                <button onClick={() => onDecline(r.link)} className="btn-sm">Decline</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {outgoing.length > 0 && (
        <div>
          <p className="label">Your requests</p>
          <ul className="mt-2 flex flex-col gap-2">
            {outgoing.map(r => (
              <li key={r.link.id} className="flex flex-wrap items-center gap-2">
                <span>Waiting for {r.person.display_name} to confirm as your {roleOf(r.link)}</span>
                <button onClick={() => onWithdraw(r.link)} className="btn-sm ml-auto">Withdraw</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {(bigs.length > 0 || littles.length > 0) && (
        <div>
          <p className="label">Remove a link</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {[...bigs, ...littles].map(r => (
              <li key={r.link.id}>
                <button onClick={() => onRemove(r.link)} aria-label={`Remove ${r.person.display_name}`} className="btn-sm text-ink-body">
                  {r.person.display_name} &times;
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
