import type { ReactNode } from 'react'
import { HeroTree, HeroTreeSmall } from '@/components/landing/HeroTree'

// TODO: restore the "Learn more about CSA" button and the footer Instagram and
// board-contact links once the club's real URLs are available. They are left
// out rather than pointed at a placeholder that goes nowhere.

const EVENTS = ['Annual cultural show', 'Holiday festivals', 'Speaker events', 'Food events', 'Trips', 'Study breaks']

const STEPS = [
  ['1', 'Claim your profile', 'Sign in with your Penn Google account. If a board member has already added you, your profile is waiting.'],
  ['2', 'Find your big', 'Search by name, open any lin, and trace your family upward. Propose a link and your big confirms it.'],
  ['3', 'Add your littles', 'Keep the tree growing. Add a personal email before you graduate so your profile stays yours.'],
] as const

// `cta` is repeated at the top and bottom of the page on purpose; `alert`
// renders once, next to the hero, so a sign-in error is not announced twice.
export function Landing({ cta, alert, footerSlot }: { cta: ReactNode; alert?: ReactNode; footerSlot?: ReactNode }) {
  return (
    <div>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8">
        <span className="heading text-lg">CSA Lins</span>
        <nav className="flex items-center gap-5 text-sm">
          <a href="#what" className="hidden text-ink-body hover:text-ink md:inline">What&#39;s a lin?</a>
          <a href="#about" className="hidden text-ink-body hover:text-ink md:inline">About CSA</a>
          <a href="#signin" className="btn-secondary h-9">Sign in</a>
        </nav>
      </header>

      <section id="signin" className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-12 md:px-8 md:py-20 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex flex-col gap-5">
          <p className="label text-accent">Penn Chinese Students&#39; Association</p>
          <h1 className="heading text-4xl md:text-5xl">Find your lin.</h1>
          <p className="max-w-lg text-lg leading-relaxed text-ink-body">
            Every CSA big and little in one family tree. Sign in to see where you fit, find your people, and add your littles.
          </p>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {cta}
              <span className="text-sm text-ink-muted">Penn accounts only</span>
            </div>
            {alert}
          </div>
        </div>
        <HeroTree className="hidden lg:block" />
        <HeroTreeSmall className="mx-auto lg:hidden" />
      </section>

      <section id="what" className="border-t border-line bg-surface-muted">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-14 md:px-8 md:py-20">
          <div className="grid gap-4 md:grid-cols-2 md:gap-12">
            <h2 className="heading text-2xl md:text-3xl">A lin is a lineage.</h2>
            <p className="text-base leading-relaxed text-ink-body">
              Each lin starts with a founder and grows one big/little pair at a time. You might have two bigs, or littles who go on to have littles of their own. The tree shows all of it, back to the first pairing.
            </p>
          </div>
          <ol className="grid gap-4 md:grid-cols-3">
            {STEPS.map(([n, title, body]) => (
              <li key={n} className="card flex flex-col gap-2 p-5">
                <span className="font-serif text-2xl font-semibold text-accent">{n}</span>
                <h3 className="heading text-base">{title}</h3>
                <p className="text-sm leading-relaxed text-ink-body">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="about" className="border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 md:grid-cols-2 md:gap-12 md:px-8 md:py-20">
          <div className="flex flex-col gap-4">
            <p className="label text-accent">About Penn CSA</p>
            <h2 className="heading text-2xl md:text-3xl">A social, cultural, and political home for Chinese and Chinese-American life at Penn.</h2>
            <p className="text-base leading-relaxed text-ink-body">
              CSA exists to build a network of people interested in Chinese and Chinese-American affairs, and to give everyone a way to learn more about the culture, history, food, and news while becoming part of a multifaceted family of members.
            </p>
          </div>
          <div className="flex flex-col gap-3 md:pt-9">
            <p className="label text-accent">What we do</p>
            <ul className="flex flex-wrap gap-2">
              {EVENTS.map(e => <li key={e} className="badge h-8 px-3 text-sm">{e}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-surface-muted">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-5 py-14 md:px-8 md:py-20">
          <h2 className="heading text-2xl md:text-3xl">See where you fit.</h2>
          <p className="max-w-lg text-base text-ink-body">Sign in with your Penn Google account to open the tree.</p>
          {cta}
          <span className="text-sm text-ink-muted">Not on a lin yet? Ask a CSA board member to add you.</span>
        </div>
      </section>

      {footerSlot}

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-5 py-6 text-sm md:flex-row md:items-center md:justify-between md:px-8">
          <span className="font-medium text-ink">CSA Lins</span>
          <span className="text-ink-muted">Penn Chinese Students&#39; Association</span>
        </div>
      </footer>
    </div>
  )
}
