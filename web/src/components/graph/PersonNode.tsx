'use client'
import { Handle, Position } from '@xyflow/react'
import { portFraction, type PersonNodeData } from '@/lib/graph/flow'
import { NODE_H, NODE_W } from '@/lib/graph/layout'

const portStyle = (index: number, total: number) => ({
  opacity: 0,
  pointerEvents: 'none',
  left: `${portFraction(index, total) * 100}%`,
}) as const

export function initials(name: string | null): string {
  if (!name) return '?'
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('')
}

// A plain pill: white, with a 2px border in the year color and the avatar
// tinted with it. The selected one gets a translucent halo in the same color
// and a light fill. An unclaimed pill is dashed and off-white, though selection
// still wins on fill and halo so the selected node stays obvious.
export function PersonNode({ data }: { data: PersonNodeData }) {
  const { person, photoUrl, selected, color, sourcePorts, targetPorts } = data
  const name = person.display_name ?? 'Unnamed'
  const unclaimed = !person.placeholder && person.claimed === false
  return (
    <div
      data-testid="pill"
      data-unclaimed={unclaimed ? 'true' : 'false'}
      aria-label={person.placeholder ? 'Hidden person' : undefined}
      aria-pressed={selected}
      style={{
        width: NODE_W, height: NODE_H, borderColor: color,
        borderStyle: unclaimed ? 'dashed' : undefined,
        boxShadow: selected ? `0 0 0 3px ${color}55` : undefined,
      }}
      className={`flex items-center gap-2 rounded-full border-2 px-1 text-sm transition-[background-color,box-shadow] duration-150 ease-out ${selected ? 'bg-surface-hover font-medium' : unclaimed ? 'bg-surface-muted' : 'bg-white'} ${person.placeholder ? 'italic text-ink-muted' : 'text-ink'}`}
    >
      {/* A separate port for each link keeps sibling lines from lying on top of one another. */}
      {sourcePorts.map((id, index) => <Handle key={`s-${id}`} type="source" id={`s-${id}`} position={Position.Bottom} style={portStyle(index, sourcePorts.length)} />)}
      {targetPorts.map((id, index) => <Handle key={`t-${id}`} type="target" id={`t-${id}`} position={Position.Top} style={portStyle(index, targetPorts.length)} />)}
      {person.placeholder ? <span className="w-full text-center text-lg font-medium not-italic">?</span> : <><span
        data-testid="avatar"
        data-unclaimed={unclaimed ? 'true' : 'false'}
        style={unclaimed ? undefined : { backgroundColor: `${color}26` }}
        className={`flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs not-italic ${unclaimed ? 'border border-dashed border-ink-faint text-ink-muted' : 'text-ink-body'}`}
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={name} className="photo h-full w-full rounded-full object-cover" />
        ) : (
          initials(person.display_name)
        )}
      </span>
      <span className="truncate font-medium">{name}</span>
      <span className="ml-auto pr-1 text-xs text-ink-muted">&#39;{String(person.grad_year).slice(-2)}</span></>}
    </div>
  )
}
