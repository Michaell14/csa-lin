'use client'
import type { Lin, LinGraph } from '@/lib/types'

export type SidePanelProps = {
  personId: string
  graph: LinGraph
  photoUrls: Map<string, string>
  lins: Lin[]
  currentLinId: string | null
  onSelectPerson: (id: string) => void
  onSelectLin: (id: string) => void
  onClose: () => void
  onGraphChanged: () => Promise<void> | void
}

export function SidePanel({ personId, graph, onClose }: SidePanelProps) {
  const p = graph.people.find(x => x.id === personId)
  return (
    <aside className="w-80 border-l p-4">
      <button onClick={onClose} className="text-sm">Close</button>
      <p className="mt-2 font-semibold">{p?.display_name ?? 'Loading…'}</p>
    </aside>
  )
}
