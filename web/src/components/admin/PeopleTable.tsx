'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { adminUpdatePerson, insertPeople, listPeople, type AdminPersonPatch } from '@/lib/api/admin'
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
    if (form.display_name !== p.display_name) patch.display_name = form.display_name.trim()
    if (Number(form.grad_year) !== p.grad_year) patch.grad_year = Number(form.grad_year)
    if (!claimed && (form.penn_email || null) !== p.penn_email) patch.penn_email = form.penn_email ? form.penn_email.trim().toLowerCase() : null
    if ((form.personal_email || null) !== p.personal_email) patch.personal_email = form.personal_email ? form.personal_email.trim().toLowerCase() : null
    try { await onSave(patch); setEdit(false) } catch (e) { setError(errorMessage(e)) }
  }

  return (
    <tr className={p.hidden ? 'text-neutral-400' : ''}>
      <td className="py-1 pr-2">{edit ? <input value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} className="w-40 rounded border px-1" /> : p.display_name}</td>
      <td className="py-1 pr-2">{edit ? <input value={form.grad_year} onChange={e => setForm({ ...form, grad_year: e.target.value })} className="w-16 rounded border px-1" /> : p.grad_year}</td>
      <td className="py-1 pr-2">{edit && !claimed ? <input value={form.penn_email} onChange={e => setForm({ ...form, penn_email: e.target.value })} className="w-48 rounded border px-1" /> : (p.penn_email ?? '—')}{claimed && <span className="ml-1 text-xs text-green-700">claimed</span>}</td>
      <td className="py-1 pr-2">{edit ? <input value={form.personal_email} onChange={e => setForm({ ...form, personal_email: e.target.value })} className="w-48 rounded border px-1" /> : (p.personal_email ?? '—')}</td>
      <td className="py-1 pr-2 whitespace-nowrap">
        {edit ? <><button onClick={save} className="mr-1 underline">Save</button><button onClick={() => setEdit(false)} className="underline">Cancel</button></>
              : <><button onClick={startEdit} className="mr-1 underline">Edit</button>
                  <button onClick={() => onSave({ hidden: !p.hidden }).catch(e => setError(errorMessage(e)))} className="underline">{p.hidden ? 'Unhide' : 'Hide'}</button></>}
        {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
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

  const reload = useCallback(async () => {
    try { setPeople(await listPeople(sb, { q, includeHidden })); setError(null) } catch (e) { setError(errorMessage(e)) }
  }, [sb, q, includeHidden])
  useEffect(() => { const t = setTimeout(() => { void reload() }, 150); return () => clearTimeout(t) }, [reload])

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <AddPersonForm nearMatches={n => searchPeople(sb, n, 5)} onAdd={async r => { await insertPeople(sb, [r]); await reload() }} />
        <BulkAddForm onAdd={async rows => { await insertPeople(sb, rows); await reload() }} />
      </div>
      <div className="flex items-center gap-3 text-sm">
        <input type="search" placeholder="Filter by name" value={q} onChange={e => setQ(e.target.value)} className="rounded border px-2 py-1" />
        <label className="flex items-center gap-1"><input type="checkbox" checked={includeHidden} onChange={e => setIncludeHidden(e.target.checked)} /> Show hidden</label>
        <span className="text-neutral-500">{people.length} people</span>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase text-neutral-500"><th>Name</th><th>Year</th><th>Penn email</th><th>Personal email</th><th></th></tr></thead>
          <tbody>{people.map(p => <Row key={p.id} p={p} onSave={async patch => { if (Object.keys(patch).length) await adminUpdatePerson(sb, p.id, patch); await reload() }} />)}</tbody>
        </table>
      </div>
    </div>
  )
}
