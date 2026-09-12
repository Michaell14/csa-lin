'use client'
import { Fragment } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { HandleSide, PersonNodeData } from '@/lib/graph/flow'
import { NODE_H, NODE_W } from '@/lib/graph/layout'

const HANDLE_SIDES: [HandleSide, Position][] = [
  ['top', Position.Top], ['bottom', Position.Bottom], ['left', Position.Left], ['right', Position.Right],
]
const HIDDEN_HANDLE = { opacity: 0, pointerEvents: 'none' } as const

export function initials(name: string | null): string {
  if (!name) return '?'
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('')
}

// A sticker pill: 2px border and hard offset shadow in the year color; the
// selected one fills gold, lifts, and casts a longer shadow. An unclaimed pill
// is dashed, cream, and shadowless, though selection still wins on fill and
// shadow so the selected node stays obvious. Nodes never tilt.
export function PersonNode({ data }: { data: PersonNodeData }) {
  const { person, photoUrl, selected, color } = data
  const name = person.placeholder ? 'Founder' : (person.display_name ?? 'Unnamed')
  const unclaimed = !person.placeholder && person.claimed === false
  return (
    <div
      data-testid="pill"
      data-unclaimed={unclaimed ? 'true' : 'false'}
      aria-pressed={selected}
      style={{
        width: NODE_W, height: NODE_H, borderColor: color,
        borderStyle: unclaimed ? 'dashed' : undefined,
        boxShadow: selected ? `5px 5px 0 ${color}` : unclaimed ? 'none' : `3px 3px 0 ${color}`,
        transform: selected ? 'translate(-2px, -2px)' : undefined,
      }}
      className={`flex items-center gap-2 rounded-full border-2 px-1 text-sm font-bold transition-[transform,box-shadow] duration-100 ${selected ? 'bg-gold' : unclaimed ? 'bg-cream' : 'bg-white'} ${person.placeholder ? 'italic text-ink-muted' : 'text-ink'}`}
    >
      {/* One source and one target handle per side; buildFlowElements picks the pair that faces the other pill. */}
      {HANDLE_SIDES.map(([side, position]) => (
        <Fragment key={side}>
          <Handle type="source" id={`s-${side}`} position={position} style={HIDDEN_HANDLE} />
          <Handle type="target" id={`t-${side}`} position={position} style={HIDDEN_HANDLE} />
        </Fragment>
      ))}
      <span
        data-testid="avatar"
        data-unclaimed={unclaimed ? 'true' : 'false'}
        className={`flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 text-xs not-italic ${unclaimed ? 'border-dashed border-ink-muted text-ink-muted' : selected ? 'border-ink bg-white text-ink' : 'border-ink bg-gold-tint text-ink'}`}
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          initials(person.placeholder ? null : person.display_name)
        )}
      </span>
      <span className="truncate">{name}</span>
      <span className={`ml-auto pr-1 text-xs font-medium ${selected ? 'text-ink' : 'text-ink-muted'}`}>&#39;{String(person.grad_year).slice(-2)}</span>
    </div>
  )
}
