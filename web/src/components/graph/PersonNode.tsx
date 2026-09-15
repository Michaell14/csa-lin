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

// A plain pill: white, with a 2px border in the year color and the avatar
// tinted with it. The selected one gets a translucent halo in the same color
// and a light fill. An unclaimed pill is dashed and off-white, though selection
// still wins on fill and halo so the selected node stays obvious.
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
        boxShadow: selected ? `0 0 0 3px ${color}55` : undefined,
      }}
      className={`flex items-center gap-2 rounded-full border-2 px-1 text-sm transition-[background-color,box-shadow] duration-150 ease-out ${selected ? 'bg-surface-hover font-medium' : unclaimed ? 'bg-surface-muted' : 'bg-white'} ${person.placeholder ? 'italic text-ink-muted' : 'text-ink'}`}
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
        style={unclaimed ? undefined : { backgroundColor: `${color}26` }}
        className={`flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs not-italic ${unclaimed ? 'border border-dashed border-ink-faint text-ink-muted' : 'text-ink-body'}`}
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={name} className="photo h-full w-full rounded-full object-cover" />
        ) : (
          initials(person.placeholder ? null : person.display_name)
        )}
      </span>
      <span className="truncate">{name}</span>
      <span className="ml-auto pr-1 text-xs text-ink-muted">&#39;{String(person.grad_year).slice(-2)}</span>
    </div>
  )
}
