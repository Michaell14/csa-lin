'use client'
import { useState, type FormEvent } from 'react'
import type { OwnProfilePatch, Person } from '@/lib/types'
import { validatePhoto } from '@/lib/api/photos'
import { errorMessage } from '@/lib/errors'
import { FIELD_LIMITS, normalizeInstagram, normalizeLinkedin, validateProfileFields } from '@/lib/profileFields'

const FIELDS: { key: keyof OwnProfilePatch; label: string; type?: string; maxLength?: number }[] = [
  { key: 'display_name', label: 'Name', maxLength: FIELD_LIMITS.display_name },
  { key: 'grad_year', label: 'Grad year', type: 'number' },
  { key: 'major', label: 'Major', maxLength: FIELD_LIMITS.major },
  { key: 'hometown', label: 'Hometown', maxLength: FIELD_LIMITS.hometown },
  { key: 'personal_email', label: 'Personal email', type: 'email' },
  { key: 'instagram', label: 'Instagram', maxLength: 31 },
  { key: 'linkedin', label: 'LinkedIn URL', maxLength: FIELD_LIMITS.linkedin },
]

export function buildPatch(person: Person, form: Record<string, string>): OwnProfilePatch {
  const patch: OwnProfilePatch = {}
  for (const f of FIELDS) {
    const raw = form[f.key] ?? ''
    if (f.key === 'grad_year') {
      const n = Number(raw)
      if (n !== person.grad_year) patch.grad_year = n
      continue
    }
    let v: string | null = raw.trim() === '' ? null : raw.trim()
    if (f.key === 'personal_email' && v) v = v.toLowerCase()
    if (f.key === 'instagram') v = normalizeInstagram(raw)
    if (f.key === 'linkedin') v = normalizeLinkedin(raw)
    if (v !== (person[f.key] ?? null)) (patch as Record<string, string | null>)[f.key] = v
  }
  const bio = form.bio ?? ''
  const b = bio.trim() === '' ? null : bio.trim()
  if (b !== (person.bio ?? null)) patch.bio = b
  return patch
}

export function ProfileEditor({ person, onSave, onCancel }: {
  person: Person
  onSave: (patch: OwnProfilePatch, photo: File | null) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState<Record<string, string>>(() => ({
    display_name: person.display_name, grad_year: String(person.grad_year), major: person.major ?? '', hometown: person.hometown ?? '',
    personal_email: person.personal_email ?? '', instagram: person.instagram ?? '', linkedin: person.linkedin ?? '', bio: person.bio ?? '',
  }))
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function onPhoto(files: FileList | null) {
    const f = files?.[0] ?? null
    if (!f) { setPhoto(null); setPhotoError(null); return }
    const problem = validatePhoto(f)
    setPhotoError(problem)
    setPhoto(problem ? null : f)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    // A rejected photo blocks saving until it is replaced; other errors clear on the next attempt.
    if (photoError) { setError(photoError); return }
    if (form.display_name.trim() === '') { setError('Name is required'); return }
    const year = Number(form.grad_year)
    if (!Number.isInteger(year) || year < 1900 || year > 2200) { setError('Grad year must be a four-digit year'); return }
    const patch = buildPatch(person, form)
    const problem = validateProfileFields(patch)
    if (problem) { setError(problem); return }
    setSaving(true); setError(null)
    try { await onSave(patch, photo) } catch (err) { setError(errorMessage(err)) } finally { setSaving(false) }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 text-sm">
      {FIELDS.map(f => (
        <label key={f.key} className="flex flex-col gap-1">
          <span className="eyebrow">{f.label}</span>
          <input type={f.type ?? 'text'} maxLength={f.maxLength} value={form[f.key] ?? ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} className="input-sm" />
        </label>
      ))}
      <label className="flex flex-col gap-1">
        <span className="eyebrow">Bio</span>
        <textarea value={form.bio} maxLength={FIELD_LIMITS.bio} onChange={e => setForm({ ...form, bio: e.target.value })} rows={3} className="input-sm h-auto py-2" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="eyebrow">Photo</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => onPhoto(e.target.files)} className="text-sm file:mr-3 file:h-9 file:cursor-pointer file:rounded-full file:border-[3px] file:border-ink file:bg-white file:px-3.5 file:text-sm file:font-bold file:text-ink" />
      </label>
      <span className="text-xs text-ink-muted">JPEG, PNG, or WebP, up to 2 MB</span>
      {(error ?? photoError) && <p role="alert" className="alert">{error ?? photoError}</p>}
      <div className="flex gap-3 pt-1">
        <button type="submit" disabled={saving} className="btn-sm-accent">Save</button>
        <button type="button" onClick={onCancel} className="btn-sm">Cancel</button>
      </div>
    </form>
  )
}
