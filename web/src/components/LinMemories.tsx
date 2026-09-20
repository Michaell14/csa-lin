'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Lin } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { useViewer } from '@/lib/viewer'
import { fetchLinsOf } from '@/lib/api/lins'
import { deleteMemory, fetchMemories, MEMORY_PAGE_SIZE, postMemory, validateMemory, type Memory } from '@/lib/api/memories'
import { CloseIcon } from './icons'
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
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [caption, setCaption] = useState('')
  const [privateToLin, setPrivateToLin] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const load = useCallback(async (offset = 0) => {
    setLoading(true)
    try {
      const rows = await fetchMemories(sb, lin.id, offset)
      setMemories(old => offset ? [...old, ...rows.filter(row => !old.some(item => item.id === row.id))] : rows)
      setMore(rows.length === MEMORY_PAGE_SIZE)
    } finally { setLoading(false) }
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
    if (!file) { setPreview(''); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  // Refresh expiring private media links while the timeline stays open.
  useEffect(() => {
    if (canPost === null) return
    const timer = setInterval(() => { void load().catch(e => setError(errorMessage(e))) }, 50 * 60 * 1000)
    return () => clearInterval(timer)
  }, [canPost, load])
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !viewer.personId || busy) return
    setBusy(true); setError('')
    try {
      await postMemory(sb, lin.id, viewer.personId, file, caption, privateToLin)
      setFile(null); setCaption(''); setPrivateToLin(false)
      if (input.current) input.current.value = ''
      await load()
    } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  async function remove(memory: Memory) {
    setBusy(true); setError('')
    try { await deleteMemory(sb, memory); setConfirmId(null); await load() }
    catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
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
        <label className="block text-sm">Photo or video
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" disabled={busy} className="mt-2 block w-full min-w-0 cursor-pointer text-xs text-ink-muted file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-line file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink file:shadow-sm hover:file:bg-surface-hover focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-50" onChange={e => {
            const next = e.target.files?.[0] ?? null
            const problem = next ? validateMemory(next) : null
            setError(problem ?? ''); setFile(problem ? null : next)
            if (problem) e.target.value = ''
          }} />
        </label>
        {preview && (file?.type.startsWith('video/') ? <video src={preview} controls className="max-h-80 w-full rounded-lg" /> : /* eslint-disable-next-line @next/next/no-img-element */
          <img src={preview} alt="Memory preview" className="max-h-80 w-full rounded-lg object-contain" />)}
        <label className="block text-sm">Caption <span className="text-ink-muted">(optional)</span>
          <textarea value={caption} onChange={e => setCaption(e.target.value)} maxLength={2000} disabled={busy} rows={2} placeholder="Dinner with the Lin 🍜" className="mt-1 block w-full rounded-lg border border-line p-3" />
        </label>
        <label className="flex cursor-pointer items-start gap-2 text-sm text-ink-body">
          <input type="checkbox" checked={privateToLin} onChange={e => setPrivateToLin(e.target.checked)} disabled={busy} className="mt-0.5 h-4 w-4 accent-accent" />
          <span className="font-medium">Only my Lin can see</span>
        </label>
        <button type="submit" disabled={!file || busy} className="btn-sm disabled:opacity-50">{busy ? 'Saving…' : 'Share memory'}</button>
      </form>}
      {loading && <p role="status" className="text-sm text-ink-muted">Loading memories…</p>}
      {!loading && !memories.length && !error && <div className="rounded-xl border border-dashed border-line p-5 text-center"><h3 className="heading text-lg">No memories yet</h3><p className="mt-2 text-sm text-ink-body">{canPost ? 'Got a group photo from dinner? Share the first memory.' : `Public memories from ${lin.name} will appear here.`}</p></div>}
      <div className="space-y-6">{memories.map((memory, index) => {
        const month = new Date(memory.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
        const previousMonth = index ? new Date(memories[index - 1].created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : null
        return <div key={memory.id}>
          {month !== previousMonth && <h3 className="mb-3 text-sm font-medium text-ink-muted">{month}</h3>}
          <article className="overflow-hidden rounded-xl border border-line bg-white">
            {memory.url ? memory.media_type === 'video' ? <video controls preload="metadata" src={memory.url} className="max-h-80 w-full bg-black" /> : /* eslint-disable-next-line @next/next/no-img-element */
              <img loading="lazy" src={memory.url} alt={memory.caption || 'A shared Lin memory'} className="max-h-80 w-full object-contain" /> : <p className="p-6 text-sm">Media unavailable. Refresh the timeline to try again.</p>}
            <div className="space-y-2 p-4">
              <time dateTime={memory.created_at} className="text-xs text-ink-muted">Posted {new Date(memory.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}{memory.author_id === viewer.personId ? ' · By you' : ''}</time>
              {memory.private_to_lin && <p className="text-xs font-medium text-ink-muted">Only {lin.name}</p>}
              {memory.caption && <p className="whitespace-pre-wrap break-words text-sm text-ink-body">{memory.caption}</p>}
              {(viewer.isAdmin || memory.author_id === viewer.personId) && (confirmId === memory.id ? <div className="flex items-center gap-3 text-sm"><span>Delete this memory?</span><button disabled={busy} className="text-red-700" onClick={() => void remove(memory)}>Delete</button><button disabled={busy} onClick={() => setConfirmId(null)}>Cancel</button></div> : <button disabled={busy} className="text-xs text-ink-muted underline" onClick={() => setConfirmId(memory.id)}>Delete memory</button>)}
            </div>
          </article>
        </div>
      })}</div>
      {more && <button disabled={loading || busy} className="btn-sm" onClick={() => void load(memories.length).catch(e => setError(errorMessage(e)))}>Older memories</button>}
    </div>
  </section>
}
