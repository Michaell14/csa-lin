'use client'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createMilestone, deleteMilestone, listMilestones, type Milestone } from '@/lib/api/milestones'
import { fetchLins } from '@/lib/api/lins'
import { errorMessage } from '@/lib/errors'
import type { Lin } from '@/lib/types'

export function MilestonesAdmin() {
  const sb = useMemo(() => createClient(), [])
  const [lins, setLins] = useState<Lin[]>([]), [items, setItems] = useState<Milestone[]>([]), [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ lin_id: '', title: '', event_date: '', description: '' })
  const reload = useCallback(async () => { try { const [ls, ms] = await Promise.all([fetchLins(sb), listMilestones(sb)]); setLins(ls); setItems(ms); setForm(f => ({ ...f, lin_id: f.lin_id || ls[0]?.id || '' })) } catch (e) { setError(errorMessage(e)) } }, [sb])
  useEffect(() => { void reload() }, [reload])
  async function submit(e: FormEvent) { e.preventDefault(); const title = form.title.trim(); if (title.length < 2) { setError('Milestone title must be at least 2 characters'); return } try { await createMilestone(sb, { ...form, title, description: form.description.trim() || null }); setError(null); setForm(f => ({ ...f, title: '', event_date: '', description: '' })); await reload() } catch (err) { setError(errorMessage(err)) } }
  const names = new Map(lins.map(l => [l.id, l.name]))
  return <div className="grid gap-6 md:grid-cols-[22rem_1fr]">
    <form onSubmit={submit} className="space-y-2 rounded-lg border p-4 text-sm"><h2 className="font-semibold">Add a milestone</h2>
      <select required value={form.lin_id} onChange={e => setForm({ ...form, lin_id: e.target.value })} className="w-full rounded border p-2">{lins.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
      <input required maxLength={120} placeholder="Milestone title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full rounded border p-2" />
      <input required type="date" value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} className="w-full rounded border p-2" />
      <textarea maxLength={2000} rows={4} placeholder="What happened?" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full rounded border p-2" />
      {error && <p role="alert" className="text-red-700">{error}</p>}<button className="rounded bg-neutral-900 px-3 py-2 text-white">Add milestone</button>
    </form>
    <div className="space-y-2">{items.map(item => <article key={item.id} className="rounded-lg border p-3 text-sm"><p className="font-medium">{item.title}</p><p className="text-xs text-neutral-500">{names.get(item.lin_id)} · {item.event_date}</p>{item.description && <p className="mt-1">{item.description}</p>}<button onClick={() => { if (confirm('Delete this milestone?')) void deleteMilestone(sb, item.id).then(reload).catch(e => setError(errorMessage(e))) }} className="mt-2 text-xs text-red-700 underline">Delete</button></article>)}</div>
  </div>
}
