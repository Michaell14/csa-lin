/**
 * Shape rules for member-editable profile fields. These mirror the check
 * constraints on `people` (migration 20260910000003) so the editor can reject
 * bad input with a friendly message before the database does, and so the
 * profile view never renders a link it would not have accepted.
 */
export const INSTAGRAM_HANDLE = /^[A-Za-z0-9._]{1,30}$/
export const LINKEDIN_URL = /^https:\/\/([a-z0-9-]+\.)?linkedin\.com\/[^\s"'<>]+$/i

export const FIELD_LIMITS = { display_name: 100, major: 100, hometown: 100, bio: 1000, linkedin: 200 } as const

/** Strips a leading @ and whitespace. Returns null for an empty value. */
export function normalizeInstagram(raw: string): string | null {
  const v = raw.trim().replace(/^@/, '')
  return v === '' ? null : v
}

/** Trims, and upgrades a bare or http:// linkedin.com address to https://. Returns null for an empty value. */
export function normalizeLinkedin(raw: string): string | null {
  const v = raw.trim()
  if (v === '') return null
  if (/^(https?:\/\/)?([a-z0-9-]+\.)?linkedin\.com\//i.test(v)) return 'https://' + v.replace(/^https?:\/\//i, '')
  return v
}

/** The instagram.com URL for a stored handle, or null if the handle is not one we would render. */
export function instagramUrl(handle: string | null): string | null {
  if (!handle) return null
  const h = handle.replace(/^@/, '')
  return INSTAGRAM_HANDLE.test(h) ? `https://instagram.com/${h}` : null
}

/** The stored LinkedIn URL if it is an https linkedin.com address, else null. */
export function safeLinkedinUrl(url: string | null): string | null {
  return url && url.length <= FIELD_LIMITS.linkedin && LINKEDIN_URL.test(url) ? url : null
}

export type ProfileFieldValues = {
  display_name?: string | null
  major?: string | null
  hometown?: string | null
  bio?: string | null
  instagram?: string | null
  linkedin?: string | null
}

/** First problem found in already-normalized values, or null when everything is acceptable. */
export function validateProfileFields(v: ProfileFieldValues): string | null {
  if (v.display_name != null && v.display_name.length > FIELD_LIMITS.display_name) return `Name must be ${FIELD_LIMITS.display_name} characters or fewer`
  if (v.major != null && v.major.length > FIELD_LIMITS.major) return `Major must be ${FIELD_LIMITS.major} characters or fewer`
  if (v.hometown != null && v.hometown.length > FIELD_LIMITS.hometown) return `Hometown must be ${FIELD_LIMITS.hometown} characters or fewer`
  if (v.bio != null && v.bio.length > FIELD_LIMITS.bio) return `Bio must be ${FIELD_LIMITS.bio} characters or fewer`
  if (v.instagram != null && !INSTAGRAM_HANDLE.test(v.instagram)) return 'Instagram must be a handle: letters, numbers, dots, and underscores only'
  if (v.linkedin != null && !safeLinkedinUrl(v.linkedin)) return 'LinkedIn must be a link starting with https://linkedin.com/ or https://www.linkedin.com/'
  return null
}
