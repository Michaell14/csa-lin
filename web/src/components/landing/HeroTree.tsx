// Illustrative version of the lin tree for the landing page: role labels
// instead of people, drawn with the same pills the real tree uses, each in a
// class-year colour from the palette.

import type { CSSProperties } from 'react'
import { PALETTE } from '@/lib/graph/colors'

type Node = { left: number; top: number; av: string; label: string; color?: string; you?: boolean; unclaimed?: boolean; italic?: boolean }

const [, , MOSS, JADE, INDIGO] = PALETTE

const NODES: Node[] = [
  { left: 226, top: 70, av: 'F', label: 'Founder', color: INDIGO, italic: true },
  { left: 226, top: 240, av: 'B', label: 'Big', color: JADE },
  { left: 86, top: 410, av: 'L', label: 'Little', color: MOSS },
  { left: 366, top: 410, av: 'L', label: 'Little', color: MOSS },
  { left: 0, top: 570, av: 'L', label: 'Little', color: MOSS },
  { left: 212, top: 570, av: 'You', label: "That's you", you: true },
  { left: 424, top: 570, av: '?', label: 'Unclaimed', unclaimed: true },
]

function Pill({ n }: { n: Node }) {
  const shell = n.unclaimed
    ? 'border-dashed border-ink-faint bg-surface-muted text-ink-muted'
    : n.you
      ? 'border-accent bg-accent-tint font-medium text-ink'
      : 'bg-white text-ink'
  const avatar = n.unclaimed
    ? 'border border-dashed border-ink-faint text-ink-muted'
    : n.you
      ? 'bg-accent text-white'
      : 'text-ink-body'
  return (
    <div
      aria-hidden
      style={{ left: n.left, top: n.top, borderColor: n.color }}
      className={`absolute flex h-14 w-[200px] items-center gap-2.5 rounded-full border-2 px-2.5 text-base ${n.italic ? 'italic text-ink-muted' : ''} ${shell}`}
    >
      <span style={n.color ? { backgroundColor: `${n.color}26` } : undefined} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm not-italic ${avatar}`}>{n.av}</span>
      <span>{n.label}</span>
    </div>
  )
}

// Drawn at a fixed 648x700 and scaled to 80% below 2xl so the hero column
// still fits on laptop widths; the outer box carries the scaled size so the
// grid reserves exactly what is painted.
export function HeroTree({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    <div aria-hidden style={style} className={`h-[560px] w-[518px] 2xl:h-[700px] 2xl:w-[648px] ${className}`}>
      <div className="relative h-[700px] w-[648px] origin-top-left scale-[0.8] 2xl:scale-100">
        <svg className="absolute inset-0" width="648" height="700" viewBox="0 0 648 700" fill="none" stroke="var(--color-ink-faint)" strokeWidth="2" strokeLinecap="round">
          <path d="M330 130v110" />
          <path d="M330 300 C330 360 190 360 190 410" />
          <path d="M330 300 C330 360 470 360 470 410" />
          <path d="M190 470 C190 530 100 530 100 570" />
          <path d="M190 470 C190 530 312 530 312 570" />
          <path d="M470 470 C470 530 524 530 524 570" />
        </svg>
        {NODES.map(n => <Pill key={n.label + n.left} n={n} />)}
      </div>
    </div>
  )
}

// Compact single-line version for phones. Drawn at a fixed 350px width --
// exactly the room a 390px phone leaves inside the hero's side padding -- and
// scaled to 80% below that so narrower phones do not clip it.
export function HeroTreeSmall({ className = '', style }: { className?: string; style?: CSSProperties }) {
  const nodes: Node[] = [
    { left: 75, top: 20, av: 'F', label: 'Founder', color: INDIGO, italic: true },
    { left: 75, top: 150, av: 'B', label: 'Big', color: JADE },
    { left: 75, top: 280, av: 'You', label: "That's you", you: true },
  ]
  return (
    <div aria-hidden style={style} className={`h-[288px] w-[280px] min-[390px]:h-[360px] min-[390px]:w-[350px] ${className}`}>
      <div className="relative h-[360px] w-[350px] origin-top-left scale-[0.8] min-[390px]:scale-100">
        <svg className="absolute inset-0" width="350" height="360" viewBox="0 0 350 360" fill="none" stroke="var(--color-ink-faint)" strokeWidth="2" strokeLinecap="round">
          <path d="M175 76v74" />
          <path d="M175 206v74" />
        </svg>
        {nodes.map(n => <Pill key={n.label} n={n} />)}
      </div>
    </div>
  )
}
