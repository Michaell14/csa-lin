import type { Supabase } from '@/lib/supabase/client'
import type { Link } from '@/lib/types'
import { assertUuid } from '@/lib/ids'

export async function fetchLinksFor(sb: Supabase, personId: string): Promise<Link[]> {
  assertUuid(personId, 'person id')
  const { data, error } = await sb.from('links').select('*')
    .or(`big_id.eq.${personId},little_id.eq.${personId}`)
    .order('created_at')
  if (error) throw error
  return data
}

export function splitLinks(links: Link[], me: string) {
  const confirmed = links.filter(l => l.status === 'confirmed')
  const pending = links.filter(l => l.status === 'pending')
  return {
    confirmedBigs: confirmed.filter(l => l.little_id === me),
    confirmedLittles: confirmed.filter(l => l.big_id === me),
    incoming: pending.filter(l => l.proposed_by !== me),
    outgoing: pending.filter(l => l.proposed_by === me),
  }
}

export async function findLinkBetween(sb: Supabase, a: string, b: string): Promise<Link | null> {
  assertUuid(a, 'person id'); assertUuid(b, 'person id')
  const { data, error } = await sb.from('links').select('*')
    .or(`and(big_id.eq.${a},little_id.eq.${b}),and(big_id.eq.${b},little_id.eq.${a})`)
    .limit(1).maybeSingle()
  if (error) throw error
  return data
}

export async function proposeLink(sb: Supabase, args: { bigId: string; littleId: string; me: string }): Promise<Link> {
  assertUuid(args.bigId, 'person id'); assertUuid(args.littleId, 'person id')
  const { data, error } = await sb.from('links')
    .insert({ big_id: args.bigId, little_id: args.littleId, status: 'pending', proposed_by: args.me })
    .select('*').single()
  if (error) throw error
  return data
}

export async function acceptLink(sb: Supabase, linkId: string, me: string): Promise<void> {
  const { error } = await sb.from('links')
    .update({ status: 'confirmed', confirmed_by: me, confirmed_at: new Date().toISOString() })
    .eq('id', linkId)
  if (error) throw error
}

export async function deleteLink(sb: Supabase, linkId: string): Promise<void> {
  const { error } = await sb.from('links').delete().eq('id', linkId)
  if (error) throw error
}
