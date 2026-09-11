'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { adminUpdatePerson, insertPeople, listPeople, type AdminPersonPatch } from '@/lib/api/admin'
import { searchPeople } from '@/lib/api/people'
import { errorMessage } from '@/lib/errors'
import type { Person } from '@/lib/types'
import { AddPersonForm } from '@/components/admin/AddPersonForm'
import { BulkAddForm } from '@/components/admin/BulkAddForm'

const PAGE_SIZE = 25
const ROW_CAP = 500

export type SortKey = 'display_name' | 'grad_year' | 'penn_email' | 'personal_email'
export type Sort = { key: SortKey; dir: 'asc' | 'desc' }

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'display_name', label: 'Name' },
  { key: 'grad_year', label: 'Year' },
  { key: 'penn_email', label: 'Penn email' },
  { key: 'personal_email', label: 'Personal email' },
]

export function sortPeople(people: Person[], sort: Sort): Person[] {
  const dir = sort.dir === 'asc' ? 1 : -1
  return [...people].sort((a, b) => {
    const x = a[sort.key]
    const y = b[sort.key]
    // Rows missing a value sort last either way, rather than clumping at one end.
    if (x === null && y === null) return a.display_name.localeCompare(b.display_name)
    if (x === null) return 1
    if (y === null) return -1
    const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))
    return cmp === 0 ? a.display_name.localeCompare(b.display_name) : cmp * dir
  })
}

function Row({ p, onSave }: { p: Person; onSave: (patch: AdminPersonPatch) => Promise<void> }) {
  const [edit, setEdit] = useState(false)
  const [form, setForm] = useState({ display_name: p.display_name, grad_year: String(p.grad_year), penn_email: p.penn_email ?? '', personal_email: p.personal_email ?? '' })
  const [error, setError] = useState<string | null>(null)
  const claimed = !!p.claimed_at

  function startEdit() {
    setForm({ display_name: p.display_name, grad_year: String(p.grad_year), penn_email: p.penn_email ?? '', personal_email: p.personal_email ?? '' })
    setError(null)
    setEdit(true)
  }

  async function save() {
    setError(null)
    const patch: AdminPersonPatch = {}
    if (form.display_name.trim() === '') { setError('Name is required'); return }
    if (form.display_name !== p.display_name) patch.display_name = form.display_name.trim()
    if (!/^\d{4}$/.test(form.grad_year.trim())) { setError('Grad year must be a four-digit year'); return }
    if (Number(form.grad_year) !== p.grad_year) patch.grad_year = Number(form.grad_year)
    if (!claimed && (form.penn_email || null) !== p.penn_email) patch.penn_email = form.penn_email ? form.penn_email.trim().toLowerCase() : null
    if ((form.personal_email || null) !== p.personal_email) patch.personal_email = form.personal_email ? form.personal_email.trim().toLowerCase() : null
    try { await onSave(patch); setEdit(false) } catch (e) { setError(errorMessage(e)) }
  }

  const action = 'rounded border px-2 py-1 text-xs hover:bg-surface-hover'
  return (
    <tr className={`border-t ${p.hidden ? 'text-ink-faint' : ''}`}>
      <td className="py-1.5 pr-2">{edit ? <input aria-label="Name" value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} className="w-40 rounded border px-1" /> : p.display_name}</td>
      <td className="py-1.5 pr-2">{edit ? <input aria-label="Grad year" value={form.grad_year} onChange={e => setForm({ ...form, grad_year: e.target.value })} className="w-16 rounded border px-1" /> : p.grad_year}</td>
      <td className="py-1.5 pr-2">{edit && !claimed ? <input aria-label="Penn email" value={form.penn_email} onChange={e => setForm({ ...form, penn_email: e.target.value })} className="w-48 rounded border px-1" /> : (p.penn_email ?? '—')}{claimed && <span className="ml-1 text-xs text-ok">claimed</span>}</td>
      <td className="py-1.5 pr-2">{edit ? <input aria-label="Personal email" value={form.personal_email} onChange={e => setForm({ ...form, personal_email: e.target.value })} className="w-48 rounded border px-1" /> : (p.personal_email ?? '—')}</td>
      <td className="whitespace-nowrap py-1.5 pr-2">
        <div className="flex gap-1">
          {edit
            ? <><button onClick={save} className={action}>Save</button><button onClick={() => setEdit(false)} className={action}>Cancel</button></>
            : <><button onClick={startEdit} className={action}>Edit</button>
                <button onClick={() => onSave({ hidden: !p.hidden }).catch(e => setError(errorMessage(e)))} className={action}>{p.hidden ? 'Unhide' : 'Hide'}</button></>}
        </div>
        {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      </td>
    </tr>
  )
}

export function PeopleTable() {
  const sb = useMemo(() => createClient(), [])
  const [q, setQ] = useState('')
  const [includeHidden, setIncludeHidden] = useState(false)
  const [people, setPeople] = useState<Person[]>([])
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>({ key: 'grad_year', dir: 'desc' })
  const [page, setPage] = useState(0)
  const seq = useRef(0)

  const reload = useCallback(async () => {
    const mine = ++seq.current
    try {
      const rows = await listPeople(sb, { q, includeHidden })
      if (mine !== seq.current) return
      setPeople(rows); setError(null)
    } catch (e) {
      if (mine !== seq.current) return
      setError(errorMessage(e))
    }
  }, [sb, q, includeHidden])
  useEffect(() => { const t = setTimeout(() => { void reload() }, 150); return () => clearTimeout(t) }, [reload])
  // A narrower filter or a different order means the old page number is meaningless.
  useEffect(() => { setPage(0) }, [q, includeHidden, sort])

  const sorted = useMemo(() => sortPeople(people, sort), [people, sort])
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const current = Math.min(page, pageCount - 1)
  const rows = sorted.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE)
  const from = sorted.length === 0 ? 0 : current * PAGE_SIZE + 1

  function toggleSort(key: SortKey) {
    setSort(s => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'grad_year' ? 'desc' : 'asc' }))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <AddPersonForm nearMatches={n => searchPeople(sb, n, 5)} onAdd={async r => { await insertPeople(sb, [r]); await reload() }} />
        <BulkAddForm onAdd={async rows => { await insertPeople(sb, rows); await reload() }} />
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <input type="search" placeholder="Filter by name" value={q} onChange={e => setQ(e.target.value)} className="rounded border px-2 py-1" />
        <label className="flex items-center gap-1"><input type="checkbox" checked={includeHidden} onChange={e => setIncludeHidden(e.target.checked)} /> Show hidden</label>
        <span className="text-ink-faint">{people.length} people</span>
      </div>
      {people.length >= ROW_CAP && (
        <p className="text-xs text-warn">Showing the first {ROW_CAP} matches. Narrow the filter to see the rest.</p>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-ink-faint">
              {COLUMNS.map(c => (
                <th key={c.key} scope="col" aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button onClick={() => toggleSort(c.key)} className="flex items-center gap-1 py-1 uppercase hover:text-ink">
                    {c.label}
                    <span aria-hidden className={sort.key === c.key ? '' : 'opacity-0'}>{sort.dir === 'asc' ? '▲' : '▼'}</span>
                  </button>
                </th>
              ))}
              <th scope="col"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>{rows.map(p => <Row key={p.id} p={p} onSave={async patch => { if (Object.keys(patch).length) await adminUpdatePerson(sb, p.id, patch); await reload() }} />)}</tbody>
        </table>
        {sorted.length === 0 && <p className="py-4 text-sm text-ink-faint">{q ? `Nobody matches “${q}”.` : 'No people yet. Add the first one above.'}</p>}
      </div>
      {sorted.length > PAGE_SIZE && (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-ink-faint">Showing {from}–{current * PAGE_SIZE + rows.length} of {sorted.length}</span>
          <div className="ml-auto flex gap-1">
            <button onClick={() => setPage(current - 1)} disabled={current === 0} className="rounded border px-2 py-1 disabled:opacity-40">Previous</button>
            <button onClick={() => setPage(current + 1)} disabled={current >= pageCount - 1} className="rounded border px-2 py-1 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
