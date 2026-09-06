'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { deleteLin, listLins, upsertLin } from '@/lib/api/admin'
import { fetchPeopleByIds } from '@/lib/api/people'
import type { PersonHit } from '@/lib/api/people'
import type { Lin } from '@/lib/types'
import { errorMessage } from '@/lib/errors'
import { PersonPicker } from '@/components/admin/PersonPicker'

export function LinsAdmin() {
  const sb = useMemo(() => createClient(), [])
  const [lins, setLins] = useState<Lin[]>([])
  const [founders, setFounders] = useState<Map<string, string>>(new Map())
  const [editing, setEditing] = useState<{ id?: string; name: string; color: string; founder: PersonHit | null } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const ls = await listLins(sb)
      setLins(ls)
      const people = await fetchPeopleByIds(sb, ls.map(l => l.founder_id))
      setFounders(new Map(people.map(p => [p.id, p.display_name])))
    } catch (e) { setError(errorMessage(e)) }
  }, [sb])
  useEffect(() => { void reload() }, [reload])

  async function save() {
    if (!editing || !editing.founder) return
    setError(null)
    try {
      await upsertLin(sb, { id: editing.id, name: editing.name.trim(), color: editing.color, founder_id: editing.founder.id })
      setEditing(null); await reload()
    } catch (e) { setError(errorMessage(e)) }
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <table className="max-w-xl">
        <thead><tr className="text-left text-xs uppercase text-neutral-500"><th>Lin</th><th>Founder</th><th></th></tr></thead>
        <tbody>
          {lins.map(l => (
            <tr key={l.id}>
              <td className="py-1 pr-2"><span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ backgroundColor: l.color }} />{l.name}</td>
              <td className="py-1 pr-2">{founders.get(l.founder_id) ?? l.founder_id.slice(0, 8)}</td>
              <td className="py-1">
                <button className="mr-2 underline" onClick={() => setEditing({ id: l.id, name: l.name, color: l.color, founder: { id: l.founder_id, display_name: founders.get(l.founder_id) ?? '', grad_year: 0, hidden: false } })}>Edit</button>
                <button className="underline" onClick={async () => { if (window.confirm(`Delete ${l.name}? People and links are kept.`)) { try { await deleteLin(sb, l.id); await reload() } catch (e) { setError(errorMessage(e)) } } }}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!editing && <button onClick={() => setEditing({ name: '', color: '#6366f1', founder: null })} className="self-start rounded border px-3 py-1">New lin</button>}
      {editing && (
        <div className="flex max-w-md flex-col gap-2 rounded-md border p-3">
          <label className="flex flex-col gap-0.5"><span className="text-xs uppercase text-neutral-500">Name</span>
            <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} className="rounded border px-2 py-1" /></label>
          <label className="flex flex-col gap-0.5"><span className="text-xs uppercase text-neutral-500">Color</span>
            <input type="color" value={editing.color} onChange={e => setEditing({ ...editing, color: e.target.value })} /></label>
          <PersonPicker label="Founder" value={editing.founder} onPick={h => setEditing({ ...editing, founder: h })} />
          <div className="flex gap-2">
            <button onClick={save} disabled={!editing.name.trim() || !editing.founder} className="rounded bg-neutral-900 px-3 py-1 text-white disabled:opacity-50">Save</button>
            <button onClick={() => setEditing(null)} className="rounded border px-3 py-1">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
