'use client'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { OwnProfilePatch, Person } from '@/lib/types'
import { validatePhoto } from '@/lib/api/photos'
import { errorMessage } from '@/lib/errors'
import { FIELD_LIMITS, normalizeInstagram, normalizeLinkedin, validateProfileFields } from '@/lib/profileFields'
import { INITIAL_CROP, loadPhoto, renderCrop, type CropState, type LoadedPhoto } from '@/lib/photoCrop'
import { PhotoCropper } from '@/components/panel/PhotoCropper'

const FIELDS: { key: keyof OwnProfilePatch; label: string; type?: string; maxLength?: number }[] = [
  { key: 'display_name', label: 'Name', maxLength: FIELD_LIMITS.display_name },
  { key: 'grad_year', label: 'Grad year', type: 'number' },
  { key: 'major', label: 'Major', maxLength: FIELD_LIMITS.major },
  { key: 'hometown', label: 'Hometown', maxLength: FIELD_LIMITS.hometown },
  { key: 'personal_email', label: 'Personal email', type: 'email' },
  { key: 'instagram', label: 'Instagram', maxLength: 31 },
  { key: 'linkedin', label: 'LinkedIn URL', maxLength: FIELD_LIMITS.linkedin },
]

// Each flag opens one field to every signed-in Penn user; all are on by default.
const PENN_VISIBILITY = [
  ['show_location', 'Show hometown'], ['show_bio_interests', 'Show bio'], ['show_socials', 'Show Instagram'], ['show_professional', 'Show major'],
] as const

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
  const [photo, setPhoto] = useState<LoadedPhoto | null>(null)
  const [crop, setCrop] = useState<CropState>(INITIAL_CROP)
  const [privacy, setPrivacy] = useState({
    show_location: person.show_location, show_bio_interests: person.show_bio_interests, show_socials: person.show_socials,
    show_professional: person.show_professional, show_linkedin: person.show_linkedin,
  })
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const pick = useRef(0)
  // The preview URL lives as long as the picked photo does.
  useEffect(() => () => photo?.revoke(), [photo])

  async function onPhoto(files: FileList | null) {
    const f = files?.[0] ?? null
    const mine = ++pick.current
    setPhoto(null); setCrop(INITIAL_CROP)
    if (!f) { setPhotoError(null); return }
    const problem = validatePhoto(f)
    if (problem) { setPhotoError(problem); return }
    try {
      const loaded = await loadPhoto(f)
      // A later pick wins; drop this one rather than showing it.
      if (mine !== pick.current) { loaded.revoke(); return }
      setPhoto(loaded)
      setPhotoError(null)
    } catch (err) { if (mine === pick.current) setPhotoError(errorMessage(err)) }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    // A rejected photo blocks saving until it is replaced; other errors clear on the next attempt.
    if (photoError) { setError(photoError); return }
    if (form.display_name.trim() === '') { setError('Name is required'); return }
    const year = Number(form.grad_year)
    if (!Number.isInteger(year) || year < 1900 || year > 2200) { setError('Grad year must be a four-digit year'); return }
    const patch = buildPatch(person, form)
    for (const key of Object.keys(privacy) as (keyof typeof privacy)[]) if (privacy[key] !== person[key]) patch[key] = privacy[key]
    const problem = validateProfileFields(patch)
    if (problem) { setError(problem); return }
    setSaving(true); setError(null)
    try {
      const cropped = photo ? await renderCrop(photo, crop) : null
      await onSave(patch, cropped)
    } catch (err) { setError(errorMessage(err)) } finally { setSaving(false) }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 text-sm">
      {FIELDS.map(f => (
        <label key={f.key} className="flex flex-col gap-1">
          <span className="label">{f.label}</span>
          <input type={f.type ?? 'text'} maxLength={f.maxLength} value={form[f.key] ?? ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} className="input-sm" />
        </label>
      ))}
      <label className="flex flex-col gap-1">
        <span className="label">Bio</span>
        <textarea value={form.bio} maxLength={FIELD_LIMITS.bio} onChange={e => setForm({ ...form, bio: e.target.value })} rows={3} className="input-sm h-auto py-2" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="label">Photo</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { void onPhoto(e.target.files) }} className="text-sm text-ink-body file:mr-3 file:h-8 file:cursor-pointer file:rounded-md file:border file:border-line-strong file:bg-white file:px-3 file:text-sm file:font-medium file:text-ink" />
      </label>
      {photo ? (
        <div className="flex flex-col gap-2">
          <PhotoCropper photo={photo} state={crop} onChange={setCrop} />
          <p className="text-xs text-ink-muted">Drag to reposition. The circle is how your photo will appear; it is saved when you press Save.</p>
          <button type="button" onClick={() => { void onPhoto(null) }} className="link self-start text-xs">Discard this photo</button>
        </div>
      ) : (
        <span className="text-xs text-ink-muted">JPEG, PNG, or WebP, up to 2 MB. You can crop and rotate it before saving.</span>
      )}
      <fieldset className="mt-2 rounded-md border border-line p-3">
        <legend className="label px-1">Visible to all Penn users</legend>
        <p className="text-xs text-ink-muted">Your name, class year, and photo are always shown. Untick a field to keep it to yourself.</p>
        {PENN_VISIBILITY.map(([key, label]) => (
          <label key={key} className="mt-2 flex items-center gap-2">
            <input type="checkbox" className="accent-accent" checked={privacy[key]} onChange={e => setPrivacy({ ...privacy, [key]: e.target.checked })} />{label}
          </label>
        ))}
      </fieldset>
      <fieldset className="rounded-md border border-line p-3">
        <legend className="label px-1">Who can see your LinkedIn</legend>
        <label className="mt-1 flex items-center gap-2">
          <input type="radio" name="linkedin_visibility" className="accent-accent" checked={!privacy.show_linkedin} onChange={() => setPrivacy({ ...privacy, show_linkedin: false })} />Only people in my lin
        </label>
        <label className="mt-2 flex items-center gap-2">
          <input type="radio" name="linkedin_visibility" className="accent-accent" checked={privacy.show_linkedin} onChange={() => setPrivacy({ ...privacy, show_linkedin: true })} />All Penn users
        </label>
      </fieldset>
      {(error ?? photoError) && <p role="alert" className="alert">{error ?? photoError}</p>}
      <div className="flex gap-3 pt-1">
        <button type="submit" disabled={saving} className="btn-sm-primary">Save</button>
        <button type="button" onClick={onCancel} className="btn-sm">Cancel</button>
      </div>
    </form>
  )
}
