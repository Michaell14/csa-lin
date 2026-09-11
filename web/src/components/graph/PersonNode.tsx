'use client'
import { Handle, Position } from '@xyflow/react'
import type { PersonNodeData } from '@/lib/graph/flow'
import { NODE_H, NODE_W } from '@/lib/graph/layout'

export function initials(name: string | null): string {
  if (!name) return '?'
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('')
}

export function PersonNode({ data }: { data: PersonNodeData }) {
  const { person, photoUrl, selected, dimmed, color } = data
  const name = person.placeholder ? 'Founder' : (person.display_name ?? 'Unnamed')
  const unclaimed = !person.placeholder && person.claimed === false
  const label = `${name}, class of ${person.grad_year}${unclaimed ? ', profile not claimed' : ''}`
  return (
    <button
      type="button"
      data-testid="pill"
      aria-pressed={selected}
      aria-label={label}
      style={{
        width: NODE_W,
        height: NODE_H,
        borderColor: color,
        boxShadow: selected ? `0 0 0 3px ${color}55` : undefined,
        opacity: dimmed ? 0.3 : 1,
      }}
      className={`flex items-center gap-2 rounded-full border-2 bg-surface px-2 text-left text-sm transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${person.placeholder ? 'italic text-ink-faint' : ''}`}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <span
        data-testid="avatar"
        data-unclaimed={unclaimed ? 'true' : 'false'}
        className={`flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs ${unclaimed ? 'border-2 border-dashed border-ink-faint text-ink-faint' : 'bg-surface-active text-ink-muted'}`}
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={name} width={28} height={28} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          initials(person.placeholder ? null : person.display_name)
        )}
      </span>
      <span className="truncate">{name}</span>
      <span className="ml-auto text-xs text-ink-faint">&#39;{String(person.grad_year).slice(-2)}</span>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </button>
  )
}
