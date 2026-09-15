'use client'
import type { Lin, Link, Person } from '@/lib/types'
import { yearColor } from '@/lib/graph/colors'
import { initials } from '@/components/graph/PersonNode'
import { instagramUrl, safeLinkedinUrl } from '@/lib/profileFields'

export type Related = { link: Link; person: Person }

function PersonPill({ p, onClick }: { p: Person; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ borderColor: yearColor(p.grad_year) }}
      className="rounded-full border-2 bg-white px-2.5 py-0.5 text-sm text-ink hover:bg-surface-hover">
      {p.display_name} <span className="text-ink-muted">&#39;{String(p.grad_year).slice(-2)}</span>
    </button>
  )
}

export function ProfileView({ person, photoUrl, bigs, littles, lins, currentLinId, onSelectPerson, onSelectLin }: {
  person: Person
  photoUrl: string | null
  bigs: Related[]
  littles: Related[]
  lins: Lin[]
  currentLinId: string | null
  onSelectPerson: (id: string) => void
  onSelectLin: (id: string) => void
}) {
  // Only render links the validators accept; anything else (legacy or tampered data) is shown as plain text.
  const igUrl = instagramUrl(person.instagram)
  const liUrl = safeLinkedinUrl(person.linkedin)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full text-lg font-medium text-ink-body" style={{ backgroundColor: `${yearColor(person.grad_year)}26`, boxShadow: `0 0 0 2px ${yearColor(person.grad_year)}` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photoUrl ? <img src={photoUrl} alt={person.display_name} className="h-full w-full object-cover" /> : initials(person.display_name)}
        </span>
        <div>
          <h2 className="heading text-lg">{person.preferred_name || person.display_name}{person.pronouns ? <span className="ml-2 text-sm font-normal tracking-normal text-ink-muted">{person.pronouns}</span> : null}</h2>
          {person.preferred_name && <p className="text-xs text-ink-muted">{person.display_name}</p>}
          <p className="text-sm text-ink-body">Class of {person.grad_year}{person.major ? ` · ${person.major}` : ''}{person.school ? ` · ${person.school}` : ''}</p>
          {!person.claimed_at && <p className="text-xs text-ink-muted">This person hasn&#39;t claimed their profile yet</p>}
        </div>
      </div>

      {(person.hometown || person.bio) && (
        <div className="text-sm">
          {person.hometown && <p className="text-ink-body">From {person.hometown}</p>}
          {person.bio && <p className="mt-1 whitespace-pre-wrap">{person.bio}</p>}
        </div>
      )}
      {(person.csa_role || person.current_city || person.interests) && <div className="space-y-1 text-sm text-ink-body">{person.csa_role && <p><strong>CSA:</strong> {person.csa_role}</p>}{person.current_city && <p><strong>Now in:</strong> {person.current_city}</p>}{person.interests && <p><strong>Ask me about:</strong> {person.interests}</p>}</div>}

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
