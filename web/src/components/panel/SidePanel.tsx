'use client'
import { useState } from 'react'
import type { Lin, LinGraph } from '@/lib/types'
import { useViewer } from '@/lib/viewer'
import { usePersonDetails } from '@/lib/hooks/usePersonDetails'
import { ProfileView } from '@/components/panel/ProfileView'

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

export function SidePanel(props: SidePanelProps) {
  const { personId, lins, currentLinId, onSelectPerson, onSelectLin, onClose } = props
  const viewer = useViewer()
  const d = usePersonDetails(personId)
  const [editing, setEditing] = useState(false)
  const isSelf = viewer.personId === personId
  const personLins = lins.filter(l => d.linIds.includes(l.id))

  return (
    <aside className="fixed inset-x-0 bottom-0 z-30 max-h-[60vh] overflow-y-auto border-t bg-white p-4 shadow-lg md:static md:max-h-none md:w-80 md:border-l md:border-t-0 md:shadow-none">
      <div className="mb-2 flex items-center justify-between">
        {isSelf && !editing && <button className="text-sm underline" onClick={() => setEditing(true)}>Edit profile</button>}
        <button onClick={onClose} aria-label="Close panel" className="ml-auto text-sm text-neutral-500">Close</button>
      </div>
      {d.error && <p role="alert" className="text-sm text-red-700">{d.error}</p>}
      {d.loading && !d.person && <p className="text-sm text-neutral-500">Loading…</p>}
      {!d.loading && !d.person && !d.error && <p className="text-sm text-neutral-500">This person is not visible.</p>}
      {d.person && !editing && (
        <ProfileView person={d.person} photoUrl={d.photoUrl} bigs={d.bigs} littles={d.littles}
          lins={personLins} currentLinId={currentLinId} onSelectPerson={onSelectPerson} onSelectLin={onSelectLin} />
      )}
      {/* Task 8 renders <ProfileEditor> here when editing; Task 9 renders <LinkRequests> below the profile when isSelf. */}
      {d.person && editing && <p className="text-sm text-neutral-500">Editing arrives in the next task.</p>}
    </aside>
  )
}
