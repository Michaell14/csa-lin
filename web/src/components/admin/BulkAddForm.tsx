'use client'
import { useState } from 'react'
import { parsePeopleCsv, type NewPerson } from '@/lib/csv'
import { errorMessage } from '@/lib/errors'
import type { BulkAddResult } from '@/lib/api/admin'

export function BulkAddForm({ onAdd }: { onAdd: (rows: NewPerson[]) => Promise<BulkAddResult> }) {
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<{ rows: NewPerson[]; errors: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<(BulkAddResult & { parseErrors: string[] }) | null>(null)
  const [saving, setSaving] = useState(false)

  async function add() {
    if (!preview || preview.rows.length === 0) return
    setError(null); setDone(null); setSaving(true)
    try {
      const result = await onAdd(preview.rows)
      setDone({ ...result, parseErrors: preview.errors })
      setText(''); setPreview(null)
    } catch (e) { setError(errorMessage(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="card flex flex-col gap-3 p-5 text-sm">
      <p className="heading text-base">Bulk add from a spreadsheet</p>
      <p className="text-ink-body">Paste rows of <code>name, grad_year, penn_email</code> (comma or tab separated; email optional).</p>
      <textarea value={text} onChange={e => { setText(e.target.value); setPreview(null); setDone(null) }} rows={6} className="input-sm h-auto py-2 font-mono" />
      <div className="flex gap-2">
        <button type="button" onClick={() => { setPreview(parsePeopleCsv(text)); setDone(null) }} className="btn-sm" disabled={saving}>Preview</button>
        {preview && preview.rows.length > 0 && <button type="button" onClick={add} className="btn-sm-primary" disabled={saving}>{saving ? 'Adding…' : `Add ${preview.rows.length} people`}</button>}
      </div>
      {preview && preview.errors.length > 0 && <ul role="alert" className="alert flex flex-col gap-1">{preview.errors.map(e => <li key={e}>{e}</li>)}</ul>}
      {preview && preview.rows.length > 0 && (
        <table className="text-xs"><tbody>{preview.rows.map((r, i) => <tr key={i}><td className="pr-2">{r.display_name}</td><td className="pr-2">{r.grad_year}</td><td>{r.penn_email ?? '—'}</td></tr>)}</tbody></table>
      )}
      {error && <p role="alert" className="alert">{error}</p>}
      {done && <div role="status" className="flex flex-col gap-2">
        <p className="font-medium text-success">Added {done.added} {done.added === 1 ? 'person' : 'people'}.</p>
        {done.duplicates.length > 0 && <div className="notice">
          <p>{done.duplicates.length} skipped because the Penn email already exists:</p>
          <ul className="list-disc pl-5">{done.duplicates.map((person, i) =>
            <li key={i}>{person.display_name} ({person.penn_email})</li>)}</ul>
        </div>}
        {done.failed.length > 0 && <div className="alert">
          <p>{done.failed.length} could not be added:</p>
          <ul className="list-disc pl-5">{done.failed.map(({ person, reason }, i) =>
            <li key={i}>{person.display_name} ({person.penn_email ?? 'no email'}): {reason}</li>)}</ul>
        </div>}
        {done.parseErrors.length > 0 && <div className="alert">
          <p>{done.parseErrors.length} invalid {done.parseErrors.length === 1 ? 'row was' : 'rows were'} skipped:</p>
          <ul className="list-disc pl-5">{done.parseErrors.map((message, i) => <li key={i}>{message}</li>)}</ul>
        </div>}
      </div>}
    </div>
  )
}
