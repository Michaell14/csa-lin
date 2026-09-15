'use client'
import { useState, type FormEvent } from 'react'
import type { PersonHit } from '@/lib/api/people'
import type { NewPerson } from '@/lib/csv'
import { errorMessage } from '@/lib/errors'

export function AddPersonForm({ nearMatches, onAdd }: {
  nearMatches: (name: string) => Promise<PersonHit[]>
  onAdd: (row: NewPerson) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [year, setYear] = useState('')
  const [email, setEmail] = useState('')
  const [similar, setSimilar] = useState<PersonHit[]>([])
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function checkSimilar() {
    const words = name.trim().split(/\s+/).filter(w => w.length > 2)
    if (words.length === 0) { setSimilar([]); return }
    try {
      const hits = (await Promise.all(words.map(w => nearMatches(w)))).flat()
      const unique = [...new Map(hits.map(h => [h.id, h])).values()]
      setSimilar(unique.slice(0, 5))
    } catch { setSimilar([]) }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null); setDone(null)
    if (!name.trim()) { setError('Name is required'); return }
    if (!/^\d{4}$/.test(year)) { setError('Grad year must be a four-digit year'); return }
    const row: NewPerson = { display_name: name.trim(), grad_year: Number(year), penn_email: email.trim() ? email.trim().toLowerCase() : null }
    try {
      await onAdd(row)
      setDone(`Added ${row.display_name}`)
      setName(''); setYear(''); setEmail(''); setSimilar([])
    } catch (err) { setError(errorMessage(err)) }
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-3 p-5 text-sm">
      <p className="heading text-base">Add a person</p>
      <label className="flex flex-col gap-0.5"><span className="label">Name</span>
        <input value={name} onChange={e => setName(e.target.value)} onBlur={checkSimilar} className="input-sm" /></label>
      {similar.length > 0 && (
        <div className="notice">
          <p>Similar names already exist. Make sure this is a new person:</p>
          <ul>{similar.map(s => <li key={s.id}>{s.display_name} &#39;{String(s.grad_year).slice(-2)}{s.hidden ? ' (hidden)' : ''}</li>)}</ul>
        </div>
      )}
      <label className="flex flex-col gap-0.5"><span className="label">Grad year</span>
        <input value={year} onChange={e => setYear(e.target.value)} inputMode="numeric" className="input-sm" /></label>
      <label className="flex flex-col gap-0.5"><span className="label">Penn email</span>
        <input value={email} onChange={e => setEmail(e.target.value)} type="email" className="input-sm" /></label>
      {error && <p role="alert" className="alert">{error}</p>}
      {done && <p className="font-medium text-success">{done}</p>}
      <button className="btn-sm-primary self-start">Add person</button>
    </form>
  )
}
