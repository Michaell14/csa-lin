'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { adminCreateLin, adminUpdateLin, deleteLin, listLins } from '@/lib/api/admin'
import { fetchPeopleByIds } from '@/lib/api/people'
import type { PersonHit } from '@/lib/api/people'
import type { Lin } from '@/lib/types'
import { errorMessage } from '@/lib/errors'
import { PersonPicker } from '@/components/admin/PersonPicker'
import { LIN_NAME_MAX } from '@/components/LinEditor'
import { PALETTE } from '@/lib/graph/colors'

function suggestedName(founder: PersonHit, lins: Lin[]): string {
  const base = `${founder.display_name}'s Lin`
  const taken = new Set(lins.map(l => l.name))
  if (!taken.has(base)) return base
  for (let n = 2; n <= 100; n++) {
    const candidate = `${base} ${n}`
    if (!taken.has(candidate)) return candidate
  }
  return base
}

function nextColor(lins: Lin[]): string {
  const counts = new Map<string, number>(PALETTE.map(color => [color, 0] as const))
  for (const lin of lins) if (counts.has(lin.color)) counts.set(lin.color, counts.get(lin.color)! + 1)
  return PALETTE.reduce((best, color) => counts.get(color)! < counts.get(best)! ? color : best)
}

export function LinsAdmin() {
  const sb = useMemo(() => createClient(), [])
  const [lins, setLins] = useState<Lin[]>([])
  const [founders, setFounders] = useState<Map<string, { name: string; grad_year: number }>>(new Map())
  const [editing, setEditing] = useState<{ id: string; name: string; color: string; founder: PersonHit | null } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [newFounder, setNewFounder] = useState<PersonHit | null>(null)
  const [newName, setNewName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [created, setCreated] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

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
      await adminUpdateLin(sb, { id: editing.id, name: editing.name.trim(), color: editing.color, founder_id: editing.founder.id })
      setEditing(null); await reload()
    } catch (e) { setError(errorMessage(e)) }
  }

  async function create() {
    const name = newName.trim()
    if (!newFounder || !name || creating) return
    setCreating(true); setCreateError(null); setCreated(null)
    try {
      await adminCreateLin(sb, { founder_id: newFounder.id, name, color: nextColor(lins) })
      setCreated(`${name} created with ${newFounder.display_name} as founder`)
      setNewFounder(null); setNewName('')
      await reload()
    } catch (e) { setCreateError(errorMessage(e)) }
    finally { setCreating(false) }
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="max-w-xl text-ink-body">A lin is associated with a founder. Confirming the first link in a chain usually creates a lin automatically for the big, assuming they don&#39;t already belong to a lin. If a removed link leaves a branch without one, an admin can create a lin for its founder here.</p>
      <form onSubmit={e => { e.preventDefault(); void create() }} className="card flex max-w-md flex-col gap-3 p-5">
        <p className="heading text-base">Create a lin</p>
        <PersonPicker label="Founder" value={newFounder} onPick={person => {
          setNewFounder(person)
          setNewName(person ? suggestedName(person, lins) : '')
          setCreateError(null); setCreated(null)
        }} />
        <label className="flex flex-col gap-0.5"><span className="label">Name</span>
          <input value={newName} onChange={e => setNewName(e.target.value)} maxLength={LIN_NAME_MAX}
            placeholder="Choose a founder for a suggested name" className="input-sm" /></label>
        {createError && <p role="alert" className="alert">{createError}</p>}
        {created && <p className="text-sm font-medium text-success">{created}</p>}
        <button type="submit" disabled={!newFounder || !newName.trim() || creating} className="btn-sm-primary self-start">
          {creating ? 'Creating…' : 'Create lin'}
        </button>
      </form>
      {error && <p role="alert" className="alert">{error}</p>}
      {lins.length === 0 && <p className="text-ink-muted">No lins yet.</p>}
      {lins.length > 0 && (
        <table className="card max-w-xl p-4 text-sm">
          <thead><tr className="label text-left"><th>Lin</th><th>Founder</th><th></th></tr></thead>
          <tbody>
            {lins.map(l => (
              <tr key={l.id}>
                <td className="py-2 pr-3"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ backgroundColor: l.color }} />{l.name}</td>
                <td className="py-2 pr-3">{founders.get(l.founder_id)?.name ?? l.founder_id.slice(0, 8)}</td>
                <td className="py-2">
                  <button className="link mr-3" onClick={() => setEditing({ id: l.id, name: l.name, color: l.color, founder: { id: l.founder_id, display_name: founders.get(l.founder_id)?.name ?? '', grad_year: founders.get(l.founder_id)?.grad_year ?? 0, hidden: false } })}>Edit</button>
                  <button className="link" onClick={async () => { if (window.confirm(`Delete ${l.name}? People and links are kept.`)) { try { await deleteLin(sb, l.id); await reload() } catch (e) { setError(errorMessage(e)) } } }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editing && (
        <div className="card flex max-w-md flex-col gap-3 p-5">
          <label className="flex flex-col gap-0.5"><span className="label">Name</span>
            <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} maxLength={LIN_NAME_MAX} className="input-sm" /></label>
          <label className="flex flex-col gap-0.5"><span className="label">Color</span>
            <input type="color" value={editing.color} onChange={e => setEditing({ ...editing, color: e.target.value })} className="h-8 w-14 cursor-pointer rounded-md border border-line-strong bg-white p-0.5" /></label>
          <PersonPicker label="Founder" value={editing.founder} onPick={h => setEditing({ ...editing, founder: h })} />
          <div className="flex gap-2">
            <button onClick={save} disabled={!editing.name.trim() || !editing.founder} className="btn-sm-primary">Save</button>
            <button onClick={() => setEditing(null)} className="btn-sm">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
