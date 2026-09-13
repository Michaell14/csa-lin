// Decorative sticker version of the lin tree for the landing page. Purely
// illustrative: role labels instead of people, tilted on purpose (the real
// tree's nodes never tilt).

type Node = { left: number; top: number; av: string; label: string; year: string; rot: number; avBg: string; avFg: string; you?: boolean; unclaimed?: boolean; italic?: boolean }

const NODES: Node[] = [
  { left: 226, top: 70, av: 'F', label: 'Founder', year: '', rot: -4, avBg: 'bg-accent', avFg: 'text-cream', italic: true },
  { left: 226, top: 240, av: 'B', label: 'Big', year: '', rot: 3, avBg: 'bg-gold', avFg: 'text-ink' },
  { left: 86, top: 410, av: 'L', label: 'Little', year: '', rot: -3, avBg: 'bg-success', avFg: 'text-cream' },
  { left: 366, top: 410, av: 'L', label: 'Little', year: '', rot: 5, avBg: 'bg-ink', avFg: 'text-cream' },
  { left: 0, top: 570, av: 'L', label: 'Little', year: '', rot: 2, avBg: 'bg-accent', avFg: 'text-cream' },
  { left: 212, top: 570, av: 'You', label: "That's you", year: '', rot: -5, avBg: 'bg-white', avFg: 'text-ink', you: true },
  { left: 424, top: 570, av: '?', label: 'Unclaimed', year: '', rot: 3, avBg: '', avFg: '', unclaimed: true },
]

function Pill({ n }: { n: Node }) {
  const shell = n.unclaimed
    ? 'border-dashed bg-cream text-ink-muted'
    : n.you
      ? 'bg-accent text-cream shadow-sticker-ink'
      : 'bg-white text-ink shadow-[4px_4px_0_var(--color-accent)]'
  const avatar = n.unclaimed
    ? 'border-2 border-dashed border-ink-muted text-ink-muted'
    : `border-2 border-ink ${n.avBg} ${n.avFg}`
  return (
    <div
      aria-hidden
      style={{ left: n.left, top: n.top, transform: `rotate(${n.rot}deg)` }}
      className={`absolute flex h-14 w-[200px] items-center gap-2.5 rounded-full border-[3px] border-ink px-2.5 text-base font-bold ${n.italic ? 'italic' : ''} ${shell}`}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm not-italic ${avatar}`}>{n.av}</span>
      <span>{n.label}</span>
    </div>
  )
}

// Drawn at a fixed 648x700 and scaled to 80% below 2xl so the hero column
// still fits on laptop widths; the outer box carries the scaled size so the
// grid reserves exactly what is painted.
export function HeroTree({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={`h-[560px] w-[518px] 2xl:h-[700px] 2xl:w-[648px] ${className}`}>
      <div className="relative h-[700px] w-[648px] origin-top-left scale-[0.8] 2xl:scale-100">
        <svg className="absolute inset-0" width="648" height="700" viewBox="0 0 648 700" fill="none" stroke="var(--color-ink)" strokeWidth="4" strokeLinecap="round">
          <path d="M330 130v110" />
          <path d="M330 300 C330 360 190 360 190 410" />
          <path d="M330 300 C330 360 470 360 470 410" />
          <path d="M190 470 C190 530 100 530 100 570" />
          <path d="M190 470 C190 530 312 530 312 570" />
          <path d="M470 470 C470 530 524 530 524 570" />
        </svg>
        {NODES.map(n => <Pill key={n.label + n.left} n={n} />)}
        <div className="absolute top-[60px] left-[470px] h-14 w-14 rotate-12 rounded-full border-[3px] border-ink bg-gold" />
        <div className="absolute top-[120px] left-10 h-10 w-10 -rotate-[16deg] rounded-tag border-[3px] border-ink bg-accent" />
        <div className="absolute top-[300px] left-[560px] h-11 w-11 rounded-full border-[3px] border-ink bg-accent" />
        <div className="absolute top-[300px] left-5 h-8 w-8 rounded-full border-[3px] border-ink bg-ink" />
      </div>
    </div>
  )
}

// Compact three-node version for phones. Drawn at a fixed 350x400 -- exactly the
// room a 390px phone leaves inside the hero's 20px side padding -- and scaled to
// 80% below that so narrower phones do not clip it.
export function HeroTreeSmall({ className = '' }: { className?: string }) {
  const nodes: Node[] = [
    { left: 85, top: 20, av: 'F', label: 'Founder', year: '', rot: -4, avBg: 'bg-accent', avFg: 'text-cream', italic: true },
    { left: 85, top: 136, av: 'B', label: 'Big', year: '', rot: 3, avBg: 'bg-gold', avFg: 'text-ink' },
    { left: 5, top: 280, av: 'You', label: "That's you", year: '', rot: -4, avBg: 'bg-white', avFg: 'text-ink', you: true },
    { left: 165, top: 280, av: '?', label: 'Unclaimed', year: '', rot: 3, avBg: '', avFg: '', unclaimed: true },
  ]
  return (
    <div aria-hidden className={`h-[320px] w-[280px] min-[390px]:h-[400px] min-[390px]:w-[350px] ${className}`}>
      <div className="relative h-[400px] w-[350px] origin-top-left scale-[0.8] min-[390px]:scale-100">
        <svg className="absolute inset-0" width="350" height="400" viewBox="0 0 350 400" fill="none" stroke="var(--color-ink)" strokeWidth="4" strokeLinecap="round">
          <path d="M175 76v60" />
          <path d="M175 192 C175 240 95 240 95 280" />
          <path d="M175 192 C175 240 255 240 255 280" />
        </svg>
        {nodes.map(n => <Pill key={n.label} n={{ ...n }} />)}
        <div className="absolute top-[30px] left-[300px] h-10 w-10 rotate-12 rounded-full border-[3px] border-ink bg-gold" />
        <div className="absolute top-[120px] left-5 h-7 w-7 -rotate-[16deg] rounded-md border-[3px] border-ink bg-accent" />
      </div>
    </div>
  )
}
