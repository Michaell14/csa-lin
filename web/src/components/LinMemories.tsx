'use client'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Lin } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { useViewer } from '@/lib/viewer'
import { fetchLinsOf } from '@/lib/api/lins'
import { deleteMemory, fetchMemories, MAX_MEMORY_ITEMS, mediaKind, MEMORY_PAGE_SIZE, postMemory, validateMemorySet, type Memory } from '@/lib/api/memories'
import { MemorySlideshow } from './MemorySlideshow'
import { CloseIcon, MoreHorizontalIcon } from './icons'
import { errorMessage } from '@/lib/errors'

export function LinMemories({ lin, onClose }: { lin: Lin; onClose?: () => void }) {
  const sb = useMemo(() => createClient(), [])
  const viewer = useViewer()
  const [canPost, setCanPost] = useState<boolean | null>(null)
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)
  const [more, setMore] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [busy, setBusy] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [caption, setCaption] = useState('')
  const [privateToLin, setPrivateToLin] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  // A page request that a later refresh has superseded must not append itself to
  // the newer timeline, report its own `more`, or raise its error.
  const request = useRef(0)
  const load = useCallback(async (offset = 0) => {
    const token = ++request.current
    const current = () => token === request.current
    setLoading(true)
    try {
      const rows = await fetchMemories(sb, lin.id, offset)
      if (!current()) return
      setMemories(old => offset ? [...old, ...rows.filter(row => !old.some(item => item.id === row.id))] : rows)
      setMore(rows.length === MEMORY_PAGE_SIZE)
    } catch (e) {
      if (current()) throw e
    } finally { if (current()) setLoading(false) }
  }, [sb, lin.id])
  useEffect(() => {
    let active = true
    async function init() {
      try {
        const member = viewer.isAdmin || Boolean(viewer.personId && (await fetchLinsOf(sb, viewer.personId)).includes(lin.id))
        if (!active) return
        setCanPost(member)
        await load()
      } catch (e) { if (active) { setError(errorMessage(e)); setLoading(false) } }
    }
    void init()
    return () => { active = false }
  }, [sb, lin.id, viewer.personId, viewer.isAdmin, load, retry])
  useEffect(() => {
    const urls = files.map(file => URL.createObjectURL(file))
    setPreviews(urls)
    return () => urls.forEach(url => URL.revokeObjectURL(url))
  }, [files])
  // Refresh expiring private media links while the timeline stays open.
  useEffect(() => {
    if (canPost === null) return
    const timer = setInterval(() => { void load().catch(e => setError(errorMessage(e))) }, 50 * 60 * 1000)
    return () => clearInterval(timer)
  }, [canPost, load])
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!files.length || !viewer.personId || busy) return
    setBusy(true); setError('')
    try {
      await postMemory(sb, lin.id, viewer.personId, files, caption, privateToLin)
      setFiles([]); setCaption(''); setPrivateToLin(false)
      if (input.current) input.current.value = ''
      await load()
    } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  async function remove(memory: Memory) {
    setBusy(true); setError('')
    try { await deleteMemory(sb, memory) }
    catch (e) { setError(errorMessage(e)); setBusy(false); return }
    // Drop the row now so a failed refresh cannot leave a deleted memory (and its
    // open confirmation) on screen to be deleted again.
    setMemories(old => old.filter(item => item.id !== memory.id))
    try { await load() } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  return <section aria-label="Lin memories" className="min-h-0 flex-1 overflow-y-auto bg-surface-muted p-4">
    <div className="space-y-5">
      <header>
        <div className="flex items-center justify-between gap-2"><h2 className="heading text-lg">Memories</h2>{onClose && <button type="button" onClick={onClose} aria-label="Close memories" className="icon-btn"><CloseIcon /></button>}</div>
        <p className="mt-1 text-xs text-ink-muted">The moments that make {lin.name}.</p>
      </header>
      {error && <p role="alert" className="text-sm text-red-700">{error} <button className="underline" onClick={() => { setError(''); setLoading(true); setRetry(n => n + 1) }}>Retry timeline</button></p>}
      {canPost && <form onSubmit={submit} className="space-y-3 rounded-xl border border-line bg-white p-4">
        <h3 className="font-medium">Add a memory</h3>
        <label className="block text-sm">Photos or videos
          <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" disabled={busy} className="mt-2 block w-full min-w-0 cursor-pointer text-xs text-ink-muted file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-line file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink file:shadow-sm hover:file:bg-surface-hover focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-50" onChange={e => {
            const next = Array.from(e.target.files ?? [])
            const problem = next.length ? validateMemorySet(next) : null
            setError(problem ?? ''); setFiles(problem ? [] : next)
            if (problem) e.target.value = ''
          }} />
        </label>
        <p className="text-xs text-ink-muted">Up to {MAX_MEMORY_ITEMS} per memory.</p>
        {files.length > 0 && <ul className="flex flex-wrap gap-2">{files.map((file, i) => <li key={`${file.name}:${i}`} className="relative">
          {file.type.startsWith('video/') ? <video src={previews[i]} aria-label={`Preview of ${file.name}`} className="h-20 w-20 rounded-lg bg-black object-cover" /> : /* eslint-disable-next-line @next/next/no-img-element */
            <img src={previews[i]} alt={`Preview of ${file.name}`} className="h-20 w-20 rounded-lg object-cover" />}
          <button type="button" aria-label={`Remove ${file.name}`} disabled={busy} onClick={() => { setFiles(files.filter((_, j) => j !== i)); if (input.current) input.current.value = '' }} className="absolute -right-1.5 -top-1.5 rounded-full border border-line bg-white p-0.5 text-ink shadow-sm hover:bg-surface-hover"><CloseIcon size={12} /></button>
        </li>)}</ul>}
        <label className="block text-sm">Caption <span className="text-ink-muted">(optional)</span>
          <textarea value={caption} onChange={e => setCaption(e.target.value)} maxLength={2000} disabled={busy} rows={2} placeholder="Dinner with the Lin 🍜" className="mt-1 block w-full rounded-lg border border-line p-3" />
        </label>
        <label className="flex cursor-pointer items-start gap-2 text-sm text-ink-body">
          <input type="checkbox" checked={privateToLin} onChange={e => setPrivateToLin(e.target.checked)} disabled={busy} className="mt-0.5 h-4 w-4 accent-accent" />
          <span className="font-medium">Only my Lin can see</span>
        </label>
        <button type="submit" disabled={!files.length || busy} className="btn-sm disabled:opacity-50">{busy ? 'Saving…' : 'Share memory'}</button>
      </form>}
      {loading && <p role="status" className="text-sm text-ink-muted">Loading memories…</p>}
      {!loading && !memories.length && !error && <div className="rounded-xl border border-dashed border-line p-5 text-center"><h3 className="heading text-lg">No memories yet</h3><p className="mt-2 text-sm text-ink-body">{canPost ? 'Got a group photo from dinner? Share the first memory.' : `Public memories from ${lin.name} will appear here.`}</p></div>}
      <div className="space-y-6">{memories.map((memory, index) => {
        const month = new Date(memory.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
        const previousMonth = index ? new Date(memories[index - 1].created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : null
        return <div key={memory.id}>
          {month !== previousMonth && <h3 className="mb-3 text-sm font-medium text-ink-muted">{month}</h3>}
          <article className="rounded-xl border border-line bg-white">
            <div className="overflow-hidden rounded-t-xl">
              {memory.media_paths.length > 1 ? <MemorySlideshow paths={memory.media_paths} urls={memory.urls} alt={memory.caption || 'A shared Lin memory'} />
                : memory.urls[0] ? mediaKind(memory.media_paths[0]) === 'video' ? <video controls preload="metadata" src={memory.urls[0]} className="max-h-80 w-full bg-black" /> : /* eslint-disable-next-line @next/next/no-img-element */
                <img loading="lazy" src={memory.urls[0]} alt={memory.caption || 'A shared Lin memory'} className="max-h-80 w-full object-contain" /> : <p className="p-6 text-sm">Media unavailable. Refresh the timeline to try again.</p>}
            </div>
            <div className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <time dateTime={memory.created_at} className="text-xs text-ink-muted">Posted {new Date(memory.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}{memory.author_id === viewer.personId ? ' · By you' : ''}</time>
                {(viewer.isAdmin || memory.author_id === viewer.personId) && <MemoryActions busy={busy} onDelete={() => remove(memory)} />}
              </div>
              {memory.private_to_lin && <p className="text-xs font-medium text-ink-muted">Only {lin.name}</p>}
              {memory.caption && <p className="whitespace-pre-wrap break-words text-sm text-ink-body">{memory.caption}</p>}
            </div>
          </article>
        </div>
      })}</div>
      {more && <button disabled={loading || busy} className="btn-sm" onClick={() => void load(memories.length).catch(e => setError(errorMessage(e)))}>Older memories</button>}
    </div>
  </section>
}

function MemoryActions({ busy, onDelete }: { busy: boolean; onDelete: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const menuItem = useRef<HTMLButtonElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node
      if (!root.current?.contains(target) && !popup.current?.contains(target)) { setOpen(false); setConfirming(false) }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false); setConfirming(false); trigger.current?.focus()
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])
  useLayoutEffect(() => {
    if (!open) { setPosition(null); return }
    const place = () => {
      if (!trigger.current || !popup.current) return
      const anchor = trigger.current.getBoundingClientRect()
      const width = popup.current.offsetWidth
      const height = popup.current.offsetHeight
      const roomBelow = window.innerHeight - anchor.bottom
      setPosition({
        top: roomBelow >= height + 8 ? anchor.bottom + 4 : Math.max(8, anchor.top - height - 4),
        left: Math.min(window.innerWidth - width - 8, Math.max(8, anchor.right - width)),
      })
    }
    place()
    window.addEventListener('resize', place)
    document.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      document.removeEventListener('scroll', place, true)
    }
  }, [open, confirming])
  useEffect(() => {
    if (!open) return
    if (confirming) cancel.current?.focus()
    else menuItem.current?.focus()
  }, [open, confirming])
  const close = () => {
    setOpen(false); setConfirming(false); trigger.current?.focus()
  }
  const floating = open && createPortal(confirming
    ? <div ref={popup} role="dialog" aria-label="Delete memory?" style={{ top: position?.top ?? 0, left: position?.left ?? 0, visibility: position ? 'visible' : 'hidden' }} className="card pop fixed z-50 w-56 p-3 shadow-elevated">
      <p className="text-sm font-medium text-ink">Delete this memory?</p>
      <p className="mt-1 text-xs text-ink-muted">This cannot be undone.</p>
      <div className="mt-3 flex justify-end gap-2">
        <button ref={cancel} type="button" disabled={busy} onClick={close} className="btn-sm">Cancel</button>
        <button type="button" disabled={busy} onClick={() => void onDelete()} className="btn-sm bg-red-700 text-white shadow-none hover:bg-red-800">Delete</button>
      </div>
    </div>
    : <div ref={popup} role="menu" style={{ top: position?.top ?? 0, left: position?.left ?? 0, visibility: position ? 'visible' : 'hidden' }} className="card pop fixed z-50 w-44 p-1 shadow-elevated">
      <button ref={menuItem} type="button" role="menuitem" onClick={() => setConfirming(true)} onKeyDown={event => {
        // Tabbing out of the portaled menu closes it; focus returns to the trigger, so
        // Tab continues from there and Shift+Tab lands on the trigger itself.
        if (event.key !== 'Tab') return
        if (event.shiftKey) event.preventDefault()
        close()
      }} className="menu-item text-red-700">Delete memory</button>
    </div>, document.body)
  return <div ref={root} className="relative shrink-0">
    <button ref={trigger} type="button" aria-label="Memory actions" aria-haspopup="menu" aria-expanded={open} disabled={busy} onClick={() => { setOpen(value => !value); setConfirming(false) }} className="icon-btn-plain -mt-2 -mr-2">
      <MoreHorizontalIcon size={18} />
    </button>
    {floating}
  </div>
}
