'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Lin, LinGraph, OwnProfilePatch } from '@/lib/types'
import { useViewer } from '@/lib/viewer'
import { usePersonDetails } from '@/lib/hooks/usePersonDetails'
import { useEscapeLayer } from '@/lib/hooks/useEscapeLayer'
import { ProfileView } from '@/components/panel/ProfileView'
import { ProfileEditor } from '@/components/panel/ProfileEditor'
import { LinkRequests } from '@/components/panel/LinkRequests'
import { AddLinkDialog } from '@/components/panel/AddLinkDialog'
import { createClient } from '@/lib/supabase/client'
import { updateOwnProfile, searchPeople } from '@/lib/api/people'
import { findLinkBetween, proposeLink, acceptLink, deleteLink } from '@/lib/api/links'
import { removeStalePhotos, uploadOwnPhoto } from '@/lib/api/photos'
import { errorMessage } from '@/lib/errors'

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
  const isSelf = viewer.personId === personId
  const d = usePersonDetails(personId, isSelf)
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState<'big' | 'little' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const panelRef = useRef<HTMLElement>(null)
  useEffect(() => { setEditing(false) }, [personId])

  // Keyboard users land in the panel when it opens, and Escape gets them out.
  useEffect(() => { panelRef.current?.focus() }, [personId])
  // Back out one layer at a time, so Escape never discards a half-filled form.
  useEscapeLayer(true, () => {
    if (adding) setAdding(null)
    else if (editing) setEditing(false)
    else onClose()
  })
  const personLins = lins.filter(l => d.linIds.includes(l.id))
  const sb = useMemo(() => createClient(), [])

  async function save(patch: OwnProfilePatch, photo: File | null) {
    const full: OwnProfilePatch = { ...patch }
    if (photo) full.photo_path = await uploadOwnPhoto(sb, personId, photo)
    if (Object.keys(full).length > 0) await updateOwnProfile(sb, personId, full)
    // Only once photo_path names the new object: clearing the old extension
    // first would leave the profile pointing at a deleted photo if the update
    // above threw.
    if (full.photo_path) await removeStalePhotos(sb, personId, full.photo_path)
    setEditing(false)
    await d.reload()
    await props.onGraphChanged()
  }

  const afterChange = useCallback(async () => { await d.reload(); await props.onGraphChanged(); await viewer.refresh() }, [d, props, viewer])
  async function run(fn: () => Promise<void>) { setActionError(null); try { await fn(); await afterChange() } catch (e) { setActionError(errorMessage(e)) } }

  return (
    <aside
      ref={panelRef}
      tabIndex={-1}
      aria-label="Person details"
      className="fixed inset-x-0 bottom-0 z-30 max-h-[70vh] overflow-y-auto rounded-t-xl border-t bg-surface p-4 shadow-lg outline-none md:static md:max-h-none md:w-80 md:rounded-none md:border-l md:border-t-0 md:shadow-none"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        {isSelf && !editing && <button className="rounded px-2 py-1.5 text-sm underline hover:bg-surface-hover" onClick={() => setEditing(true)}>Edit profile</button>}
        <button onClick={onClose} aria-label="Close panel" className="ml-auto rounded px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-hover">Close</button>
      </div>
      {d.error && <p role="alert" className="text-sm text-danger">{d.error}</p>}
      {d.loading && !d.person && <p className="text-sm text-ink-faint">Loading…</p>}
      {!d.loading && !d.person && !d.error && <p className="text-sm text-ink-faint">This person is not visible.</p>}
      {d.person && !(isSelf && editing) && (
        <ProfileView person={d.person} photoUrl={d.photoUrl} bigs={d.bigs} littles={d.littles}
          lins={personLins} currentLinId={currentLinId} onSelectPerson={onSelectPerson} onSelectLin={onSelectLin} />
      )}
      {isSelf && d.person && !editing && (
        <div className="mt-4 flex flex-col gap-3">
          {actionError && <p role="alert" className="text-sm text-danger">{actionError}</p>}
          <LinkRequests me={personId} incoming={d.incoming} outgoing={d.outgoing} bigs={d.bigs} littles={d.littles}
            onAccept={l => run(() => acceptLink(sb, l.id, personId))}
            onDecline={l => run(() => deleteLink(sb, l.id))}
            onWithdraw={l => run(() => deleteLink(sb, l.id))}
            onRemove={l => run(() => deleteLink(sb, l.id))} />
          {!adding && (
            <div className="flex gap-2 text-sm">
              <button onClick={() => setAdding('big')} className="rounded border px-2 py-1">Add a big</button>
              <button onClick={() => setAdding('little')} className="rounded border px-2 py-1">Add a little</button>
            </div>
          )}
          {adding && (
            <AddLinkDialog role={adding} me={personId}
              search={q => searchPeople(sb, q)}
              check={other => findLinkBetween(sb, personId, other)}
              onPropose={async other => {
                const bigId = adding === 'big' ? other : personId
                const littleId = adding === 'big' ? personId : other
                await proposeLink(sb, { bigId, littleId, me: personId })
                await afterChange()
              }}
              onClose={() => setAdding(null)} />
          )}
        </div>
      )}
      {d.person && isSelf && editing && <ProfileEditor person={d.person} onSave={save} onCancel={() => setEditing(false)} />}
    </aside>
  )
}
