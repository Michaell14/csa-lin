'use client'
import type { Lin, Link, Person } from '@/lib/types'
import { yearColor } from '@/lib/graph/colors'
import { initials } from '@/components/graph/PersonNode'

export type Related = { link: Link; person: Person }

function PersonPill({ p, onClick }: { p: Person; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ borderColor: yearColor(p.grad_year) }}
      className="rounded-full border-2 px-2 py-0.5 text-sm hover:bg-surface-muted">
      {p.display_name} <span className="text-ink-faint">&#39;{String(p.grad_year).slice(-2)}</span>
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
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-surface-active text-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photoUrl ? <img src={photoUrl} alt={person.display_name} width={64} height={64} decoding="async" className="h-full w-full object-cover" /> : initials(person.display_name)}
        </span>
        <div>
          <h2 className="text-lg font-semibold">{person.display_name}</h2>
          <p className="text-sm text-ink-muted">Class of {person.grad_year}{person.major ? ` · ${person.major}` : ''}</p>
          {!person.claimed_at && <p className="text-xs text-ink-faint">This person hasn&#39;t claimed their profile yet</p>}
        </div>
      </div>

      {(person.hometown || person.bio) && (
        <div className="text-sm">
          {person.hometown && <p className="text-ink-muted">From {person.hometown}</p>}
          {person.bio && <p className="mt-1 whitespace-pre-wrap">{person.bio}</p>}
        </div>
      )}

      {(person.instagram || person.linkedin) && (
        <div className="flex gap-3 text-sm">
          {person.instagram && <a className="underline" href={`https://instagram.com/${person.instagram.replace(/^@/, '')}`} target="_blank" rel="noreferrer">@{person.instagram.replace(/^@/, '')}</a>}
          {person.linkedin && <a className="underline" href={person.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>}
        </div>
      )}

      {lins.length > 0 && (
        <div>
          <p className="text-xs uppercase text-ink-faint">Lins</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {lins.map(l => (
              <button key={l.id} onClick={() => onSelectLin(l.id)} aria-current={l.id === currentLinId}
                style={{ borderColor: l.color, backgroundColor: l.id === currentLinId ? l.color : undefined, color: l.id === currentLinId ? '#fff' : undefined }}
                className="rounded-full border-2 px-2 py-0.5 text-xs">{l.name}</button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs uppercase text-ink-faint">Bigs</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {bigs.length === 0 && <span className="text-sm text-ink-faint">None recorded</span>}
          {bigs.map(r => <PersonPill key={r.link.id} p={r.person} onClick={() => onSelectPerson(r.person.id)} />)}
        </div>
      </div>
      <div>
        <p className="text-xs uppercase text-ink-faint">Littles</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {littles.length === 0 && <span className="text-sm text-ink-faint">None recorded</span>}
          {littles.map(r => <PersonPill key={r.link.id} p={r.person} onClick={() => onSelectPerson(r.person.id)} />)}
        </div>
      </div>
    </div>
  )
}
