'use client'
import type { Lin } from '@/lib/types'

export function LinTabs({ lins, selectedId, onSelect }: { lins: Lin[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto">
      {lins.map(lin => {
        const selected = lin.id === selectedId
        return (
          <button
            key={lin.id}
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(lin.id)}
            style={{ borderColor: lin.color, backgroundColor: selected ? lin.color : undefined, color: selected ? '#fff' : undefined }}
            className="whitespace-nowrap rounded-full border-2 px-3 py-1 text-sm"
          >
            {lin.name}
          </button>
        )
      })}
    </div>
  )
}
