'use client'
import type { Lin, Link, Person } from '@/lib/types'
import { yearColor } from '@/lib/graph/colors'
import { initials } from '@/components/graph/PersonNode'
import { instagramUrl, safeLinkedinUrl } from '@/lib/profileFields'
import { AlertIcon } from '@/components/icons'

export type Related = { link: Link; person: Person }

function PersonPill({ p, onClick }: { p: Person; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ borderColor: yearColor(p.grad_year) }}
      className="rounded-full border-2 bg-white px-2.5 py-0.5 text-sm text-ink hover:bg-surface-hover">
      {p.display_name} <span className="text-ink-muted">&#39;{String(p.grad_year).slice(-2)}</span>
    </button>
  )
}

export function ProfileView({ person, photoUrl, bigs, littles, lins, currentLinId, onSelectPerson, onSelectLin, onAddPersonalEmail }: {
  person: Person
  photoUrl: string | null
  bigs: Related[]
  littles: Related[]
  lins: Lin[]
  currentLinId: string | null
  onSelectPerson: (id: string) => void
  onSelectLin: (id: string) => void
  onAddPersonalEmail?: () => void
}) {
  // Only render links the validators accept; anything else (legacy or tampered data) is shown as plain text.
  const igUrl = instagramUrl(person.instagram)
  const liUrl = safeLinkedinUrl(person.linkedin)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full text-lg font-medium text-ink-body" style={{ backgroundColor: `${yearColor(person.grad_year)}26`, boxShadow: `0 0 0 2px ${yearColor(person.grad_year)}` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photoUrl ? <img src={photoUrl} alt={person.display_name} className="photo h-full w-full rounded-full object-cover" /> : initials(person.display_name)}
        </span>
        <div>
          <h2 className="heading text-lg">{person.display_name}</h2>
          <p className="text-sm text-ink-body">Class of {person.grad_year}{person.major ? ` · ${person.major}` : ''}</p>
          {!person.claimed_at && <p className="text-xs text-ink-muted">This person hasn&#39;t claimed their profile yet</p>}
        </div>
      </div>

      {onAddPersonalEmail && (
        <div className="flex items-start gap-2 rounded-md border border-accent-line bg-accent-tint px-3 py-2 text-xs text-ink-body">
          <AlertIcon size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-accent" />
          <p>Add a personal email linked to a Google account so you can sign in after your Penn email expires.{' '}
            <button onClick={onAddPersonalEmail} className="link font-medium">Add email</button>
          </p>
        </div>
      )}

      {(person.hometown || person.bio) && (
        <div className="text-sm">
          {person.hometown && <p className="text-ink-body">From {person.hometown}</p>}
          {person.bio && <p className="mt-1 whitespace-pre-wrap">{person.bio}</p>}
        </div>
      )}
      {(person.instagram || person.linkedin) && (
        <div className="flex gap-3 text-sm">
          {person.instagram && (igUrl
            ? <a className="link" href={igUrl} target="_blank" rel="noreferrer noopener">@{person.instagram.replace(/^@/, '')}</a>
            : <span className="text-ink-muted">Instagram: {person.instagram}</span>)}
          {person.linkedin && (liUrl
            ? <a className="link" href={liUrl} target="_blank" rel="noreferrer noopener">LinkedIn</a>
            : <span className="text-ink-muted">LinkedIn link not shown (not a linkedin.com address)</span>)}
        </div>
      )}

      {lins.length > 0 && (
        <div>
          <p className="label">Lins</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {lins.map(l => (
              <button key={l.id} onClick={() => onSelectLin(l.id)} aria-current={l.id === currentLinId}
                style={{ borderColor: l.color, backgroundColor: l.id === currentLinId ? l.color : undefined, color: l.id === currentLinId ? '#fff' : undefined }}
                className="rounded-full border-2 bg-white px-2.5 py-0.5 text-xs font-medium text-ink hover:bg-surface-hover">{l.name}</button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="label">Bigs</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {bigs.length === 0 && <span className="text-sm text-ink-muted">None recorded</span>}
          {bigs.map(r => <PersonPill key={r.link.id} p={r.person} onClick={() => onSelectPerson(r.person.id)} />)}
        </div>
      </div>
      <div>
        <p className="label">Littles</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {littles.length === 0 && <span className="text-sm text-ink-muted">None recorded</span>}
          {littles.map(r => <PersonPill key={r.link.id} p={r.person} onClick={() => onSelectPerson(r.person.id)} />)}
        </div>
      </div>
    </div>
  )
}
