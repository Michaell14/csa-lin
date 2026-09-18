import type { CSSProperties, ReactNode } from 'react'
import { HeroTree, HeroTreeSmall } from '@/components/landing/HeroTree'
import { BrandTitle } from '@/components/BrandTitle'

const STEPS = [
  ['1', 'Claim your profile', 'Sign in with Penn Google. If a board member has already added you, your profile is waiting!'],
  ['2', 'Find your big', 'Search by name, open any lin, and trace your family upward!'],
  ['3', 'Grow your family', 'Add your littles! Add a personal email before you graduate so your profile stays yours.'],
] as const

// The header and hero both offer sign-in; `alert` renders once next to the hero
// so a sign-in error is not announced twice.
export function Landing({ cta, secondaryCta, onSignIn, alert, footerSlot }: { cta: ReactNode; secondaryCta?: ReactNode; onSignIn: () => void; alert?: ReactNode; footerSlot?: ReactNode }) {
  return (
    <div>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8">
        <BrandTitle className="flex" />
        <nav className="flex items-center gap-5 text-sm">
          <a href="#what" className="hidden text-ink-body hover:text-ink md:inline">What&#39;s a lin?</a>
          <button type="button" onClick={onSignIn} className="btn-secondary">Sign in</button>
        </nav>
      </header>

      <section id="signin" className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-12 md:px-8 md:py-20 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="stagger flex flex-col gap-5">
          <p className="label text-sm text-accent">Penn Chinese Students&#39; Association</p>
          <h1 className="heading text-4xl md:text-5xl">Find your lin.</h1>
          <p className="max-w-lg text-lg leading-relaxed text-ink-body">
            Every CSA big and little in a global family tree. Sign in to see your lineage!
          </p>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {cta}
              <span className="text-sm text-ink-muted">Penn accounts only</span>
            </div>
            {secondaryCta}
            {alert}
          </div>
        </div>
        <HeroTree className="fade-in-up hidden lg:block" style={{ '--delay': '200ms' } as CSSProperties} />
        <HeroTreeSmall className="fade-in-up mx-auto lg:hidden" style={{ '--delay': '200ms' } as CSSProperties} />
      </section>

      <section id="what" className="border-t border-line bg-surface-muted">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-14 md:px-8 md:py-20">
          <div className="grid gap-4 md:grid-cols-2 md:gap-12">
            <h2 className="heading text-2xl md:text-3xl">A lin is a family of bigs and littles.</h2>
            <p className="text-base leading-relaxed text-ink-body">
              Each lin starts with a founder and grows one big/little pair at a time. You might have two bigs, or littles who go on to have littles of their own. The tree shows all of it, back to the first pairing.
            </p>
          </div>
          <ol className="grid gap-4 md:grid-cols-3">
            {STEPS.map(([n, title, body]) => (
              <li key={n} className="card flex flex-col gap-2 p-5">
                <span className="font-serif text-2xl font-semibold text-accent">{n}</span>
                <h3 className="heading text-base">{title}</h3>
                <p className="text-sm leading-relaxed text-ink-body">{n === '1' && secondaryCta ? 'Sign in with Penn Google, or use an email code if you’re in the Nursing School. If a board member has already added you, your profile is waiting!' : body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {footerSlot}

      <footer className="border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-2 px-5 py-6 text-center text-sm lg:grid-cols-3 lg:items-center lg:px-8">
          <span className="font-medium text-ink lg:text-left">CSA Lins</span>
          <span className="text-ink-muted">Made with ❤️ by Michael, Evan, and Jasmin</span>
          <span className="text-ink-muted lg:text-right">Penn Chinese Students&#39; Association</span>
        </div>
      </footer>
    </div>
  )
}
