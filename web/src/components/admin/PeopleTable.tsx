'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { adminUpdatePerson, insertPeople, insertPeopleNonBlocking, listPeople, type AdminPersonPatch } from '@/lib/api/admin'
import { searchPeople } from '@/lib/api/people'
import { errorMessage } from '@/lib/errors'
import type { Person } from '@/lib/types'
import { AddPersonForm } from '@/components/admin/AddPersonForm'
import { BulkAddForm } from '@/components/admin/BulkAddForm'

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

  return (
    <tr className={`border-b border-line ${p.hidden ? 'text-ink-muted' : ''}`}>
      <td className="py-2 pr-3">{edit ? <input value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} className="input-sm h-8 w-40" /> : p.display_name}</td>
      <td className="py-2 pr-3">{edit ? <input value={form.grad_year} onChange={e => setForm({ ...form, grad_year: e.target.value })} className="input-sm h-8 w-16" /> : p.grad_year}</td>
      <td className="py-2 pr-3">{edit && !claimed ? <input value={form.penn_email} onChange={e => setForm({ ...form, penn_email: e.target.value })} className="input-sm h-8 w-48" /> : (p.penn_email ?? '—')}{claimed && <span className="badge ml-2 border-success-tint bg-success-tint text-success">claimed</span>}</td>
      <td className="py-2 pr-3">{edit ? <input value={form.personal_email} onChange={e => setForm({ ...form, personal_email: e.target.value })} className="input-sm h-8 w-48" /> : (p.personal_email ?? '—')}</td>
      <td className="py-2 pr-3 whitespace-nowrap">
        {edit ? <><button onClick={save} className="link mr-3">Save</button><button onClick={() => setEdit(false)} className="link">Cancel</button></>
              : <><button onClick={startEdit} className="link mr-3">Edit</button>
                  <button onClick={() => onSave({ hidden: !p.hidden }).catch(e => setError(errorMessage(e)))} className="link">{p.hidden ? 'Unhide' : 'Hide'}</button></>}
        {error && <p role="alert" className="error mt-1 text-xs">{error}</p>}
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

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <AddPersonForm nearMatches={n => searchPeople(sb, n, { limit: 5 })} onAdd={async r => { await insertPeople(sb, [r]); await reload() }} />
        <BulkAddForm onAdd={async rows => { const result = await insertPeopleNonBlocking(sb, rows); await reload(); return result }} />
      </div>
      <div className="flex items-center gap-3 text-sm">
        <input type="search" placeholder="Filter by name" value={q} onChange={e => setQ(e.target.value)} className="input-sm w-56" />
        <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-accent" checked={includeHidden} onChange={e => setIncludeHidden(e.target.checked)} /> Show hidden</label>
        <span className="badge">{people.length} people</span>
      </div>
      {error && <p role="alert" className="alert">{error}</p>}
      <div className="card overflow-x-auto p-4">
        <table className="w-full text-sm">
          <thead><tr className="label text-left"><th className="pb-2 font-medium">Name</th><th>Year</th><th>Penn email</th><th>Personal email</th><th></th></tr></thead>
          <tbody>{people.map(p => <Row key={p.id} p={p} onSave={async patch => { if (Object.keys(patch).length) await adminUpdatePerson(sb, p.id, patch); await reload() }} />)}</tbody>
        </table>
      </div>
    </div>
  )
}
