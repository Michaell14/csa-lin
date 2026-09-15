'use client'
import { useState } from 'react'
import { parsePeopleCsv, type NewPerson } from '@/lib/csv'
import { errorMessage } from '@/lib/errors'

export function BulkAddForm({ onAdd }: { onAdd: (rows: NewPerson[]) => Promise<void> }) {
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<{ rows: NewPerson[]; errors: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function add() {
    if (!preview || preview.rows.length === 0) return
    setError(null); setDone(null)
    try { await onAdd(preview.rows); setDone(`Added ${preview.rows.length} people`); setText(''); setPreview(null) }
    catch (e) { setError(errorMessage(e)) }
  }

  return (
    <div className="card flex flex-col gap-3 p-5 text-sm">
      <p className="heading text-base">Bulk add from a spreadsheet</p>
      <p className="text-ink-body">Paste rows of <code>name, grad_year, penn_email</code> (comma or tab separated; email optional).</p>
      <textarea value={text} onChange={e => { setText(e.target.value); setPreview(null) }} rows={6} className="input-sm h-auto py-2 font-mono" />
      <div className="flex gap-2">
        <button type="button" onClick={() => setPreview(parsePeopleCsv(text))} className="btn-sm">Preview</button>
        {preview && preview.rows.length > 0 && <button type="button" onClick={add} className="btn-sm-primary">Add {preview.rows.length} people</button>}
      </div>
      {preview && preview.errors.length > 0 && <ul role="alert" className="alert flex flex-col gap-1">{preview.errors.map(e => <li key={e}>{e}</li>)}</ul>}
      {preview && preview.rows.length > 0 && (
        <table className="text-xs"><tbody>{preview.rows.map((r, i) => <tr key={i}><td className="pr-2">{r.display_name}</td><td className="pr-2">{r.grad_year}</td><td>{r.penn_email ?? '—'}</td></tr>)}</tbody></table>
      )}
      {error && <p role="alert" className="alert">{error}</p>}
      {done && <p className="font-medium text-success">{done}</p>}
    </div>
  )
}
