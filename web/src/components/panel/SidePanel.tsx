'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Lin, LinGraph, OwnProfilePatch } from '@/lib/types'
import { useViewer } from '@/lib/viewer'
import { usePersonDetails, type PersonDetails } from '@/lib/hooks/usePersonDetails'
import { ProfileView } from '@/components/panel/ProfileView'
import { ProfileEditor } from '@/components/panel/ProfileEditor'
import { LinkRequests } from '@/components/panel/LinkRequests'
import { AddLinkDialog } from '@/components/panel/AddLinkDialog'
import { createClient } from '@/lib/supabase/client'
import { updateOwnProfile, searchPeople } from '@/lib/api/people'
import { findLinkBetween, proposeLink, acceptLink, deleteLink } from '@/lib/api/links'
import { removeStalePhotos, uploadOwnPhoto } from '@/lib/api/photos'
import { errorMessage } from '@/lib/errors'
import type { RelationshipPath as RelationshipPathData } from '@/lib/graph/relationship'
import { RelationshipPath } from '@/components/panel/RelationshipPath'
import { ReportIssue } from '@/components/panel/ReportIssue'

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
  // Supplied when the panel is showing the viewer themselves, so the page, the
  // panel and the onboarding checklist all read and reload one set of details.
  details?: PersonDetails
  relationshipPath?: RelationshipPathData | null
}

export function SidePanel(props: SidePanelProps) {
  const { personId, lins, currentLinId, onSelectPerson, onSelectLin, onClose } = props
  const viewer = useViewer()
  const isSelf = viewer.personId === personId
  const own = usePersonDetails(personId, isSelf, !props.details)
  const d = props.details ?? own
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState<'big' | 'little' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  useEffect(() => { setEditing(false) }, [personId])
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented) onClose() }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])
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
    <aside aria-label="Person profile" className="fixed inset-x-0 bottom-0 z-30 max-h-[75vh] overflow-y-auto rounded-t-card border-t-[3px] border-ink bg-white p-4 md:static md:max-h-none md:w-80 md:rounded-none md:border-t-0 md:border-l-[3px]">
      <div className="mb-3 flex items-center justify-between">
        {isSelf && !editing && <button className="btn-sm" onClick={() => setEditing(true)}>Edit profile</button>}
        <button onClick={onClose} aria-label="Close panel" className="ml-auto flex h-10 w-10 items-center justify-center rounded-full border-2 border-ink bg-white text-sm font-bold hover:bg-gold-tint md:h-8 md:w-8">×</button>
      </div>
      {d.error && <p role="alert" className="alert">{d.error}</p>}
      {d.loading && !d.person && <p className="text-sm text-ink-muted">Loading…</p>}
      {!d.loading && !d.person && !d.error && <p className="text-sm text-ink-muted">This person is not visible.</p>}
      {d.person && !(isSelf && editing) && (
        <>
          {!isSelf && props.relationshipPath && <div className="mb-4"><RelationshipPath graph={props.graph} path={props.relationshipPath} onSelectPerson={onSelectPerson} /></div>}
          <ProfileView person={d.person} photoUrl={d.photoUrl} bigs={d.bigs} littles={d.littles}
            lins={personLins} currentLinId={currentLinId} onSelectPerson={onSelectPerson} onSelectLin={onSelectLin} />
        </>
      )}
      {isSelf && d.person && !editing && (
        <div className="mt-5 flex flex-col gap-4 border-t-[3px] border-ink pt-4">
          {actionError && <p role="alert" className="alert">{actionError}</p>}
          <LinkRequests me={personId} incoming={d.incoming} outgoing={d.outgoing} bigs={d.bigs} littles={d.littles}
            onAccept={l => run(() => acceptLink(sb, l.id, personId))}
            onDecline={l => run(() => deleteLink(sb, l.id))}
            onWithdraw={l => run(() => deleteLink(sb, l.id))}
            onRemove={l => { if (window.confirm('Remove this link?')) void run(() => deleteLink(sb, l.id)) }} />
          {!adding && (
            <div className="flex flex-wrap gap-3">
              <button onClick={() => setAdding('big')} className="btn-sm">Add a big</button>
              <button onClick={() => setAdding('little')} className="btn-sm">Add a little</button>
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
      {d.person && !editing && <div className="mt-5 border-t pt-3"><ReportIssue personId={personId} /></div>}
    </aside>
  )
}
