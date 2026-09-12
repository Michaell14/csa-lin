import type { ReactNode } from 'react'
import { HeroTree, HeroTreeSmall } from '@/components/landing/HeroTree'

// TODO: restore the "Learn more about CSA" button and the footer Instagram and
// board-contact links once the club's real URLs are available. They are left
// out rather than pointed at a placeholder that goes nowhere.

const EVENTS = ['Annual cultural show', 'Holiday festivals', 'Speaker events', 'Food events', 'Trips', 'Study breaks']

const STEPS = [
  ['01', 'Claim your profile', 'Sign in with your Penn Google account. If a board member has already added you, your profile is waiting.'],
  ['02', 'Find your big', 'Search by name, open any lin, and trace your family upward. Propose a link and your big confirms it.'],
  ['03', 'Add your littles', 'Keep the tree growing. Add a personal email before you graduate so your profile stays yours.'],
] as const

function Marquee() {
  const items = [...EVENTS, "Penn Chinese Students' Association"]
  const seq = (key: string) => items.map(e => (
    <span key={key + e} className="flex items-center gap-6">
      <span>{e}</span>
      <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full bg-gold" />
    </span>
  ))
  return (
    <div className="overflow-hidden border-y-[3px] border-ink bg-accent py-4 text-[15px] font-bold tracking-[0.04em] text-cream uppercase">
      <div className="marquee flex w-max gap-6">
        {seq('a')}{seq('b')}
      </div>
    </div>
  )
}

export function Landing({ cta, footerSlot }: { cta: ReactNode; footerSlot?: ReactNode }) {
  return (
    <div className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(color-mix(in_srgb,var(--color-accent)_20%,transparent)_1.5px,transparent_1.5px)] bg-[size:28px_28px]" />

      <header className="relative flex items-center justify-between px-5 py-4 md:px-14 md:py-6">
        <span className="display -rotate-2 rounded-input border-[3px] border-ink bg-white px-3 py-1 text-[22px] shadow-sticker md:text-[28px]">CSA Lins</span>
        <nav className="hidden items-center gap-3 md:flex">
          <a href="#what" className="btn-outline">What&#39;s a lin?</a>
          <a href="#about" className="btn-outline">About CSA</a>
          <a href="#about" className="btn-outline">Events</a>
          <a href="#signin" className="btn-gold">Sign in</a>
        </nav>
        <a href="#signin" className="btn-gold md:hidden">Sign in</a>
      </header>

      <section id="signin" className="relative grid gap-8 px-5 py-8 md:gap-10 md:px-14 md:py-10 xl:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex flex-col justify-center gap-6 md:gap-7">
          <span className="sticker-tag -rotate-3 self-start bg-accent text-cream">Penn CSA · big/little</span>
          <h1 className="display text-[60px] leading-[0.92] md:text-[104px]">
            Find your <span className="sticker-word">lin.</span>
          </h1>
          <p className="max-w-[520px] text-lg leading-[1.45] text-ink-body md:text-xl">
            Every CSA big and little, stuck together in one big family tree. Sign in, find your people, add your littles.
          </p>
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            {cta}
            <span className="text-sm text-ink-muted">Penn accounts only</span>
          </div>
        </div>
        <HeroTree className="hidden xl:block" />
        <HeroTreeSmall className="mx-auto xl:hidden" />
      </section>

      <div className="relative"><Marquee /></div>

      <section id="what" className="relative flex flex-col gap-8 px-5 py-14 md:gap-10 md:px-14 md:py-24">
        <div className="grid items-end gap-6 md:grid-cols-2 md:gap-12">
          <h2 className="display text-[42px] leading-[0.96] md:text-[64px]">
            A lin is a lineage, not a <span className="sticker-word rotate-2">list.</span>
          </h2>
          <p className="text-base leading-[1.5] text-ink-body md:text-xl">
            Each lin starts with a founder and grows one big/little pair at a time. You might have two bigs, or littles who go on to found families of their own. The tree shows all of it, back to the very first pairing.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3 md:gap-8">
          {STEPS.map(([n, title, body], i) => (
            <div key={n} className="card flex flex-col gap-4 p-6 md:p-8">
              <span className={`display flex h-[52px] w-[52px] items-center justify-center rounded-full border-[3px] border-ink bg-gold text-xl shadow-sticker-sm ${['-rotate-3', 'rotate-3', '-rotate-2'][i]}`}>{n}</span>
              <h3 className="display text-[26px] tracking-[-0.02em]">{title}</h3>
              <p className="text-base leading-[1.55] text-ink-body">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="about" className="relative mx-5 grid gap-6 rounded-section border-[3px] border-ink bg-accent p-6 text-cream shadow-[8px_8px_0_var(--color-ink)] md:mx-14 md:grid-cols-2 md:gap-16 md:p-[72px]">
        <div className="flex flex-col gap-5 md:gap-6">
          <span className="sticker-tag -rotate-2 self-start bg-gold text-ink">About Penn CSA</span>
          <h2 className="display text-[34px] leading-[1] md:text-[44px] md:leading-[1]">A social, cultural, and political home for Chinese and Chinese-American life at Penn.</h2>
          <p className="text-base leading-[1.55] text-blush">
            CSA exists to build a network of people interested in Chinese and Chinese-American affairs, and to give everyone a way to learn more about the culture, history, food, and news while becoming part of a multifaceted family of members.
          </p>
        </div>
        <div className="flex flex-col justify-center gap-5">
          <span className="eyebrow text-gold">What we do</span>
          <div className="flex flex-wrap gap-x-3.5 gap-y-4 py-2">
            {EVENTS.map((e, i) => (
              <span key={e} className={`inline-flex h-11 items-center rounded-full border-[3px] border-ink bg-white px-4 text-[15px] font-bold text-ink shadow-sticker-ink md:text-lg ${['-rotate-2', 'rotate-2', '-rotate-1', 'rotate-3', '-rotate-3', 'rotate-1'][i]}`}>{e}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="relative flex flex-col items-center gap-6 px-5 py-20 text-center md:gap-7 md:py-32">
        <h2 className="display max-w-[900px] text-[46px] leading-[0.96] md:text-[80px] md:leading-[0.94]">
          Your lin is already <span className="sticker-word">waiting.</span>
        </h2>
        <p className="max-w-[520px] text-base text-ink-body md:text-lg">Sign in with your Penn Google account to see where you fit in the family tree.</p>
        {cta}
        <span className="text-sm text-ink-muted">Not on a lin yet? Ask a CSA board member to add you.</span>
      </section>

      {footerSlot}

      <footer className="relative flex flex-col gap-3 border-t-[3px] border-ink bg-white px-5 py-6 text-sm font-bold md:flex-row md:items-center md:justify-between md:px-14">
        <span className="display text-xl tracking-[-0.02em]">CSA Lins</span>
        <span className="font-medium text-ink-muted">Penn Chinese Students&#39; Association</span>
      </footer>
    </div>
  )
}
