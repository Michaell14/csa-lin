import type { ChangelogRow } from '@/lib/types'

const NOISE = new Set(['updated_at', 'created_at'])
const short = (v: unknown) => (typeof v === 'string' && v.length >= 8 ? v.slice(0, 8) : String(v))
const fmt = (v: unknown) => (v === null || v === undefined ? 'null' : typeof v === 'string' ? `"${v}"` : String(v))
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

export function summarizeChange(row: ChangelogRow): string {
  const head = `${row.table_name} ${row.action}`
  const before = obj(row.before), after = obj(row.after)
  if (row.action === 'update') {
    const changes = Object.keys({ ...before, ...after })
      .filter(k => !NOISE.has(k) && JSON.stringify(before[k]) !== JSON.stringify(after[k]))
      .map(k => `${k} ${fmt(before[k])} → ${fmt(after[k])}`)
    return `${head}: ${changes.join(', ') || 'no visible change'}`
  }
  const r = row.action === 'insert' ? after : before
  if (row.table_name === 'links') return `${head}: big=${short(r.big_id)} little=${short(r.little_id)} ${String(r.status ?? '')}`.trim()
  if (row.table_name === 'admins') return `${head}: person=${short(r.person_id)}`
  if (row.table_name === 'people') return `${head}: ${String(r.display_name ?? short(r.id))}`
  if (row.table_name === 'lins') return `${head}: ${String(r.name ?? short(r.id))}`
  return head
}
