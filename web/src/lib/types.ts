import type { Database } from '@/lib/database.types'

export type Person = Database['public']['Tables']['people']['Row']
export type Link = Database['public']['Tables']['links']['Row']
export type Lin = Pick<Database['public']['Tables']['lins']['Row'], 'id' | 'name' | 'color' | 'founder_id'>
export type ChangelogRow = Database['public']['Tables']['changelog']['Row']

export type GraphPerson = {
  id: string
  is_founder: boolean
  placeholder: boolean
  display_name: string | null
  grad_year: number
  photo_path: string | null
  major: string | null
  hometown: string | null
  bio: string | null
  instagram: string | null
  linkedin: string | null
  claimed: boolean | null
}
export type GraphLink = { id: string; big_id: string; little_id: string; academic_year: string | null }
export type LinGraph = { people: GraphPerson[]; links: GraphLink[] }

// What the UI is entitled to say about a lin's membership. The graph on hand
// belongs to the previous lin until a new request lands, and a failed request
// never produces one at all, so "no members" is only ever true when 'ready'.
export type MembersStatus = 'ready' | 'loading' | 'unavailable'

export type OwnProfilePatch = Partial<Pick<Person,
  'display_name' | 'preferred_name' | 'pronouns' | 'grad_year' | 'personal_email' | 'photo_path' | 'major' | 'school' | 'current_city' | 'interests' | 'csa_role' | 'hometown' | 'bio' | 'instagram' | 'linkedin'>>
