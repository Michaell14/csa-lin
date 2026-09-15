/** Friendly text for database rules a user can trip from the profile editor or admin forms. */
const CONSTRAINT_MESSAGES: Record<string, string> = {
  people_instagram_handle: 'Instagram must be a handle: letters, numbers, dots, and underscores only',
  people_linkedin_url: 'LinkedIn must be a link starting with https://linkedin.com/ or https://www.linkedin.com/',
  people_display_name_len: 'Name must be 100 characters or fewer',
  people_major_len: 'Major must be 100 characters or fewer',
  people_hometown_len: 'Hometown must be 100 characters or fewer',
  people_bio_len: 'Bio must be 1000 characters or fewer',
  people_photo_path_own_folder: 'Photo must be uploaded through the profile editor',
  lins_name_key: 'A lin with that name already exists',
  lins_name_check: 'Lin name cannot be blank',
  lins_name_len: 'Lin name must be 120 characters or fewer',
  lins_color_check: 'Color must be a hex color like #c63d2f',
}

function friendly(message: string): string {
  for (const [name, text] of Object.entries(CONSTRAINT_MESSAGES)) {
    if (message.includes(`"${name}"`)) return text
  }
  return message
}

export function errorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    return friendly((e as { message: string }).message)
  }
  if (e instanceof Error) return friendly(e.message)
  return 'Something went wrong'
}
