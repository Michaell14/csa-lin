'use client'
export const ADMIN_TABS = ['People', 'Links', 'Lins', 'Milestones', 'Requests', 'Corrections', 'Admins', 'Merge', 'Changelog'] as const
export type AdminTab = typeof ADMIN_TABS[number]

export function AdminTabs({ tab, onChange }: { tab: AdminTab; onChange: (t: AdminTab) => void }) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1 border-b border-line">
      {ADMIN_TABS.map(t => (
        <button key={t} role="tab" aria-selected={t === tab} onClick={() => onChange(t)}
          className={`-mb-px border-b-2 px-3 py-2 text-sm ${t === tab ? 'border-ink font-medium text-ink' : 'border-transparent text-ink-muted hover:text-ink'}`}>{t}</button>
      ))}
    </div>
  )
}
