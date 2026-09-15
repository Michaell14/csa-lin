'use client'
import { useState } from 'react'
import type { Lin } from '@/lib/types'
import type { LinPatch } from '@/lib/api/lins'
import { errorMessage } from '@/lib/errors'

// Mirrors the `lins_name_len` check in the database.
export const LIN_NAME_MAX = 120

// The founder's controls over their lin: its name and colour. A lin is founded
// by the database when a link is confirmed, so this is the only edit a member
// ever makes to one; who founded it is an admin's to correct.
export function LinEditor({ lin, onSave, onCancel }: {
  lin: Lin
  onSave: (patch: Required<LinPatch>) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(lin.name)
  const [color, setColor] = useState(lin.color)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const trimmed = name.trim()
  const valid = trimmed.length > 0 && trimmed.length <= LIN_NAME_MAX

  async function save() {
    if (!valid || busy) return
    setBusy(true); setError(null)
    try { await onSave({ name: trimmed, color }) } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }

  return (
    <form aria-label="Edit lin" onSubmit={e => { e.preventDefault(); void save() }} className="flex flex-wrap items-end gap-3 border-b border-line bg-surface-muted px-3 py-2 text-sm sm:px-4">
      <label className="flex flex-col gap-0.5">
        <span className="label">Lin name</span>
        <input value={name} onChange={e => setName(e.target.value)} maxLength={LIN_NAME_MAX} className="input-sm w-56" />
      </label>
      <label className="flex flex-col gap-0.5">
        <span className="label">Color</span>
        <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-8 w-14 cursor-pointer rounded-md border border-line-strong bg-white p-0.5" />
      </label>
      <button type="submit" disabled={!valid || busy} className="btn-sm-primary">{busy ? 'Saving…' : 'Save'}</button>
      <button type="button" onClick={onCancel} className="btn-sm">Cancel</button>
      {error && <p role="alert" className="alert basis-full">{error}</p>}
    </form>
  )
}
