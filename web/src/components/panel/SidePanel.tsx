'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Lin, LinGraph, OwnProfilePatch } from '@/lib/types'
import { useViewer } from '@/lib/viewer'
import { usePersonDetails, type PersonDetails } from '@/lib/hooks/usePersonDetails'
import { ProfileView } from '@/components/panel/ProfileView'
import { ProfileEditor } from '@/components/panel/ProfileEditor'
import { LinkRequests } from '@/components/panel/LinkRequests'
import { AddLinkDialog } from '@/components/panel/AddLinkDialog'
import { createClient } from '@/lib/supabase/client'
import { updateOwnProfile, searchPeople } from '@/lib/api/people'
import { findLinkBetween, proposeLink, acceptLink, deleteLink, requestLinkRemoval, pendingRemovalRequests, withdrawLinkRemoval, type PendingRemovalRequest } from '@/lib/api/links'
import { removeStalePhotos, uploadOwnPhoto } from '@/lib/api/photos'
import { errorMessage } from '@/lib/errors'
import type { RelationshipPath as RelationshipPathData } from '@/lib/graph/relationship'
import { RelationshipPath } from '@/components/panel/RelationshipPath'
import { ReportIssue } from '@/components/panel/ReportIssue'
import { ChevronLeftIcon, CloseIcon, PencilIcon, PlusIcon } from '@/components/icons'

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
  // Supplied when the panel is showing the viewer themselves so the page and
  // panel share one set of details.
  relationshipPath?: RelationshipPathData | null
  details?: PersonDetails
  viewerLinIds: string[]
}

export function SidePanel(props: SidePanelProps) {
  const { personId, lins, currentLinId, onSelectPerson, onSelectLin, onClose } = props
  const viewer = useViewer()
  const isSelf = viewer.personId === personId
  const fetchedDetails = usePersonDetails(personId, isSelf, !props.details)
  const d = props.details ?? fetchedDetails
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState<'big' | 'little' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pendingRemovals, setPendingRemovals] = useState<Map<string, PendingRemovalRequest>>(new Map())
  const pendingRefreshVersion = useRef(0)
  useEffect(() => { setEditing(false) }, [personId])
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (editing) setEditing(false)
      else onClose()
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [editing, onClose])
  const personLins = lins.filter(l => d.linIds.includes(l.id))
  const sb = useMemo(() => createClient(), [])
  const confirmedIds = useMemo(() => [...d.bigs, ...d.littles].map(r => r.link.id), [d.bigs, d.littles])
  const confirmedIdKey = confirmedIds.join(',')
  useEffect(() => {
    if (!isSelf) { setPendingRemovals(new Map()); return }
    let active = true
    const refresh = () => {
      const version = ++pendingRefreshVersion.current
      void pendingRemovalRequests(sb, confirmedIdKey ? confirmedIdKey.split(',') : [])
        .then(requests => { if (active && version === pendingRefreshVersion.current) setPendingRemovals(requests) })
        .catch(e => { if (active && version === pendingRefreshVersion.current) setActionError(errorMessage(e)) })
    }
    refresh()
    window.addEventListener('focus', refresh)
    const interval = window.setInterval(refresh, 30_000)
    return () => { active = false; window.removeEventListener('focus', refresh); window.clearInterval(interval) }
  }, [sb, isSelf, confirmedIdKey])

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
  async function submitRemoval(linkId: string) {
    setActionError(null)
    try {
      const requestId = await requestLinkRemoval(sb, linkId, personId)
      // Ignore any refresh that started before the new request was saved.
      pendingRefreshVersion.current++
      setPendingRemovals(requests => new Map(requests).set(linkId, { id: requestId, requestedBy: personId }))
    } catch (e) { setActionError(errorMessage(e)) }
  }
  async function withdrawRemoval(linkId: string, requestId: string) {
    setActionError(null)
    try {
      await withdrawLinkRemoval(sb, requestId)
      pendingRefreshVersion.current++
      setPendingRemovals(requests => {
        const next = new Map(requests)
        next.delete(linkId)
        return next
      })
    } catch (e) { setActionError(errorMessage(e)) }
  }

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        {isSelf && !editing && <button className="btn-sm" onClick={() => setEditing(true)}><PencilIcon size={14} />Edit profile</button>}
        <button autoFocus onClick={() => { if (editing) setEditing(false); else onClose() }}
          aria-label={editing ? 'Back to profile' : 'Close panel'} className="icon-btn ml-auto h-10 w-10 md:h-8 md:w-8">
          {editing ? <ChevronLeftIcon /> : <CloseIcon />}
        </button>
      </div>
      {d.error && <p role="alert" className="alert">{d.error}</p>}
      {d.loading && !d.person && <p className="text-sm text-ink-muted">Loading…</p>}
      {!d.loading && !d.person && !d.error && <p className="text-sm text-ink-muted">This person is not visible.</p>}
      {d.person && !(isSelf && editing) && (
        <>
          {!isSelf && props.relationshipPath && <div className="mb-4"><RelationshipPath graph={props.graph} path={props.relationshipPath} onSelectPerson={onSelectPerson} /></div>}
          <ProfileView person={d.person} photoUrl={d.photoUrl} bigs={d.bigs} littles={d.littles}
            lins={personLins} currentLinId={currentLinId} onSelectPerson={onSelectPerson} onSelectLin={onSelectLin}
            onAddPersonalEmail={isSelf && !d.person.personal_email ? () => setEditing(true) : undefined} />
        </>
      )}
      {isSelf && d.person && !editing && (
        <div className="mt-5 flex flex-col gap-4 border-t border-line pt-4">
          {actionError && <p role="alert" className="alert">{actionError}</p>}
          <LinkRequests me={personId} incoming={d.incoming} outgoing={d.outgoing} bigs={d.bigs} littles={d.littles} pendingRemovals={pendingRemovals}
            onAccept={l => run(() => acceptLink(sb, l.id, personId))}
            onDecline={l => run(() => deleteLink(sb, l.id))}
            onWithdraw={l => run(() => deleteLink(sb, l.id))}
            onWithdrawRemoval={(linkId, requestId) => { void withdrawRemoval(linkId, requestId) }}
            onRemove={l => { void submitRemoval(l.id) }} />
          {!adding && (
            <div>
              <p className="label mb-2">Add a link</p>
              <div className="flex flex-wrap gap-3">
                <button onClick={() => setAdding('big')} className="btn-sm-add"><PlusIcon size={14} />Add a big</button>
                <button onClick={() => setAdding('little')} className="btn-sm-add"><PlusIcon size={14} />Add a little</button>
              </div>
            </div>
          )}
          {d.linIds.length === 0 && <p className="text-xs text-ink-muted">Not in a lin yet? One starts on its own once you and a big or little confirm your link.</p>}
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
      {d.person && !editing && (isSelf || d.linIds.some(id => props.viewerLinIds.includes(id))) &&
        <div className="mt-5 border-t border-line pt-3"><ReportIssue personId={personId} /></div>}
    </div>
  )
}
