'use client'
export const ADMIN_TABS = ['People', 'Links', 'Lins', 'Requests', 'Admins', 'Merge', 'Changelog'] as const
export type AdminTab = typeof ADMIN_TABS[number]

export function AdminTabs({ tab, onChange }: { tab: AdminTab; onChange: (t: AdminTab) => void }) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1 border-b pb-2">
      {ADMIN_TABS.map(t => (
        <button key={t} role="tab" aria-selected={t === tab} onClick={() => onChange(t)}
          className={`rounded-full px-3 py-1 text-sm ${t === tab ? 'bg-neutral-900 text-white' : 'border'}`}>{t}</button>
      ))}
    </div>
  )
}
