'use client'
import { useEffect, useState } from 'react'
import type { Link } from '@/lib/types'
import type { PendingRemovalRequest } from '@/lib/api/links'
import type { Related } from '@/components/panel/ProfileView'
import { ChevronRightIcon } from '@/components/icons'

export function describeExisting(link: Link, me: string): string {
  if (link.status === 'confirmed') return 'This link is already confirmed'
  if (link.proposed_by === me) return 'You already requested this link'
  return 'They already requested this link; accept it below'
}

export function LinkRequests({ me, incoming, outgoing, bigs, littles, pendingRemovals, onAccept, onDecline, onWithdraw, onWithdrawRemoval, onRemove }: {
  me: string
  incoming: Related[]
  outgoing: Related[]
  bigs: Related[]
  littles: Related[]
  pendingRemovals?: Map<string, PendingRemovalRequest>
  onAccept: (l: Link) => void
  onDecline: (l: Link) => void
  onWithdraw: (l: Link) => void
  onWithdrawRemoval: (linkId: string, requestId: string) => void
  onRemove: (l: Link) => void
}) {
  const roleOf = (l: Link) => (l.big_id === me ? 'little' : 'big')
  const related = [...bigs, ...littles]
  // Removal is rare and easy to hit by accident, so it sits folded away. It
  // unfolds on its own once a request is pending, so the state (and the way to
  // cancel it) is not hidden, and stays put after that until toggled.
  const hasPending = related.some(r => pendingRemovals?.has(r.link.id))
  const [showRemoval, setShowRemoval] = useState(hasPending)
  useEffect(() => { if (hasPending) setShowRemoval(true) }, [hasPending])
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
                <span>Waiting for request to be approved: {r.person.display_name} as your {roleOf(r.link)}</span>
                <button onClick={() => onWithdraw(r.link)} className="btn-sm ml-auto">Withdraw</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {(bigs.length > 0 || littles.length > 0) && (
        <div>
          <button type="button" onClick={() => setShowRemoval(open => !open)} aria-expanded={showRemoval}
            className="flex items-center gap-1 text-xs text-ink-muted transition-colors duration-100 hover:text-ink">
            <ChevronRightIcon size={12} className={`transition-transform duration-150 ${showRemoval ? 'rotate-90' : ''}`} />
            Need to remove a big or little?
          </button>
          {showRemoval && <>
          <p className="mt-2 text-xs text-ink-muted">A removal request goes to an admin for review. Use it only when a link is wrong.</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {related.map(r => {
              const request = pendingRemovals?.get(r.link.id)
              const canWithdraw = request?.requestedBy === me
              return (
                <li key={r.link.id}>
                  <button onClick={() => {
                    if (canWithdraw) onWithdrawRemoval(r.link.id, request.id)
                    else if (!request) onRemove(r.link)
                  }} disabled={Boolean(request && !canWithdraw)}
                    aria-label={`${canWithdraw ? 'Cancel removal request for' : 'Request removal of'} ${r.person.display_name}`}
                    className={`btn-sm border border-accent ${canWithdraw ? 'bg-accent-tint text-accent hover:bg-[#f7d8d0]' : 'bg-paper text-ink hover:bg-accent-tint'}`}>
                    {r.person.display_name} · {canWithdraw ? 'Cancel removal request' : request ? 'Awaiting admin review' : 'Request removal'}
                  </button>
                </li>
              )
            })}
          </ul>
          </>}
        </div>
      )}
    </div>
  )
}
