'use client'
export const ADMIN_TABS = ['People', 'Links', 'Lins', 'Milestones', 'Requests', 'Corrections', 'Admins', 'Merge', 'Changelog'] as const
export type AdminTab = typeof ADMIN_TABS[number]

export function AdminTabs({ tab, onChange }: { tab: AdminTab; onChange: (t: AdminTab) => void }) {
  return (
    <div role="tablist" className="flex flex-wrap gap-2 border-b-[3px] border-ink pb-4">
      {ADMIN_TABS.map(t => (
        <button key={t} role="tab" aria-selected={t === tab} onClick={() => onChange(t)}
          className={t === tab ? 'btn-sm-accent' : 'btn-sm'}>{t}</button>
      ))}
    </div>
  )
}
