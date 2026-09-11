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
    <div className="flex flex-col gap-2 rounded-md border p-3 text-sm">
      <p className="font-medium">Bulk add from a spreadsheet</p>
      <p className="text-ink-muted">Paste rows of <code>name, grad_year, penn_email</code> (comma or tab separated; email optional).</p>
      <textarea value={text} onChange={e => { setText(e.target.value); setPreview(null) }} rows={6} className="rounded border px-2 py-1 font-mono" />
      <div className="flex gap-2">
        <button type="button" onClick={() => setPreview(parsePeopleCsv(text))} className="rounded border px-3 py-1">Preview</button>
        {preview && preview.rows.length > 0 && <button type="button" onClick={add} className="rounded bg-accent px-3 py-1 text-accent-ink">Add {preview.rows.length} people</button>}
      </div>
      {preview && preview.errors.length > 0 && <ul role="alert" className="text-danger">{preview.errors.map(e => <li key={e}>{e}</li>)}</ul>}
      {preview && preview.rows.length > 0 && (
        <table className="text-xs"><tbody>{preview.rows.map((r, i) => <tr key={i}><td className="pr-2">{r.display_name}</td><td className="pr-2">{r.grad_year}</td><td>{r.penn_email ?? '—'}</td></tr>)}</tbody></table>
      )}
      {error && <p role="alert" className="text-danger">{error}</p>}
      {done && <p className="text-ok">{done}</p>}
    </div>
  )
}
