'use client'
export const ADMIN_TABS = ['People', 'Links', 'Lins', 'Requests', 'Corrections', 'Admins', 'Merge', 'Changelog'] as const
export type AdminTab = typeof ADMIN_TABS[number]

export function AdminTabs({ tab, onChange, counts }: {
  tab: AdminTab
  onChange: (t: AdminTab) => void
  counts: { requests: number; corrections: number } | null
}) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1 border-b border-line">
      {ADMIN_TABS.map(t => {
        const count = t === 'Requests' ? counts?.requests : t === 'Corrections' ? counts?.corrections : 0
        return (
          <button key={t} role="tab" aria-selected={t === tab} onClick={() => onChange(t)}
            aria-label={count ? `${t}, ${count} pending` : t}
            className={`relative -mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors duration-100 after:absolute after:inset-x-0 after:-inset-y-0.5 after:content-[''] ${t === tab ? 'border-ink font-medium text-ink' : 'border-transparent text-ink-muted hover:text-ink'}`}>
            {t}{count ? <span aria-hidden="true" className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-semibold leading-none text-white tabular-nums">{count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
