import type { Supabase } from '@/lib/supabase/client'
import type { GraphLink, GraphPerson, LinGraph } from '@/lib/types'

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

export function parseLinGraph(raw: unknown): LinGraph {
  const r = asRecord(raw) ?? {}
  const peopleRaw = Array.isArray(r.people) ? r.people : []
  const linksRaw = Array.isArray(r.links) ? r.links : []
  const people: GraphPerson[] = peopleRaw.map((p, i) => {
    const o = asRecord(p)
    if (!o || typeof o.id !== 'string') throw new Error(`lin_graph person #${i} has no id`)
    return {
      id: o.id,
      is_founder: o.is_founder === true,
      placeholder: o.placeholder === true,
      display_name: typeof o.display_name === 'string' ? o.display_name : null,
      grad_year: typeof o.grad_year === 'number' ? o.grad_year : 0,
      photo_path: typeof o.photo_path === 'string' ? o.photo_path : null,
      major: typeof o.major === 'string' ? o.major : null,
      hometown: typeof o.hometown === 'string' ? o.hometown : null,
      bio: typeof o.bio === 'string' ? o.bio : null,
      instagram: typeof o.instagram === 'string' ? o.instagram : null,
      linkedin: typeof o.linkedin === 'string' ? o.linkedin : null,
      claimed: typeof o.claimed === 'boolean' ? o.claimed : null,
    }
  })
  const ids = new Set(people.map(p => p.id))
  const links: GraphLink[] = linksRaw.flatMap(l => {
    const o = asRecord(l)
    if (!o || typeof o.id !== 'string' || typeof o.big_id !== 'string' || typeof o.little_id !== 'string') return []
    if (!ids.has(o.big_id) || !ids.has(o.little_id)) return []
    return [{ id: o.id, big_id: o.big_id, little_id: o.little_id }]
  })
  return { people, links }
}

export async function fetchLinGraph(sb: Supabase, linId: string): Promise<LinGraph> {
  const { data, error } = await sb.rpc('lin_graph', { lin: linId })
  if (error) throw error
  return parseLinGraph(data)
}
