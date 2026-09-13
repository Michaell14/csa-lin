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
  const [founders, setFounders] = useState<Map<string, { name: string; grad_year: number }>>(new Map())
  const [editing, setEditing] = useState<{ id?: string; name: string; color: string; founder: PersonHit | null } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const ls = await listLins(sb)
      setLins(ls)
      const people = await fetchPeopleByIds(sb, ls.map(l => l.founder_id))
      setFounders(new Map(people.map(p => [p.id, { name: p.display_name, grad_year: p.grad_year }])))
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
      {error && <p role="alert" className="alert">{error}</p>}
      <table className="card max-w-xl p-4">
        <thead><tr className="eyebrow text-left"><th>Lin</th><th>Founder</th><th></th></tr></thead>
        <tbody>
          {lins.map(l => (
            <tr key={l.id}>
              <td className="py-2 pr-3"><span className="mr-2 inline-block h-3.5 w-3.5 rounded-full border-2 border-ink align-middle" style={{ backgroundColor: l.color }} />{l.name}</td>
              <td className="py-2 pr-3">{founders.get(l.founder_id)?.name ?? l.founder_id.slice(0, 8)}</td>
              <td className="py-2">
                <button className="link mr-3" onClick={() => setEditing({ id: l.id, name: l.name, color: l.color, founder: { id: l.founder_id, display_name: founders.get(l.founder_id)?.name ?? '', grad_year: founders.get(l.founder_id)?.grad_year ?? 0, hidden: false } })}>Edit</button>
                <button className="link" onClick={async () => { if (window.confirm(`Delete ${l.name}? People and links are kept.`)) { try { await deleteLin(sb, l.id); await reload() } catch (e) { setError(errorMessage(e)) } } }}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!editing && <button onClick={() => setEditing({ name: '', color: '#c63d2f', founder: null })} className="btn-sm self-start">New lin</button>}
      {editing && (
        <div className="card flex max-w-md flex-col gap-3 p-5">
          <label className="flex flex-col gap-0.5"><span className="eyebrow">Name</span>
            <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} className="input-sm" /></label>
          <label className="flex flex-col gap-0.5"><span className="eyebrow">Color</span>
            <input type="color" value={editing.color} onChange={e => setEditing({ ...editing, color: e.target.value })} className="h-10 w-16 cursor-pointer rounded-tag border-[3px] border-ink bg-white p-0.5" /></label>
          <PersonPicker label="Founder" value={editing.founder} onPick={h => setEditing({ ...editing, founder: h })} />
          <div className="flex gap-2">
            <button onClick={save} disabled={!editing.name.trim() || !editing.founder} className="btn-sm-accent">Save</button>
            <button onClick={() => setEditing(null)} className="btn-sm">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
