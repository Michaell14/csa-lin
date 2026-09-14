import { describe, it, expect } from 'vitest'
import { summarizeChange } from '@/lib/changelog'
import type { ChangelogRow } from '@/lib/types'

const base = { id: 1, actor_id: null, created_at: '2026-09-06T00:00:00Z', row_id: '00000000-0000-0000-0000-000000000002' }

describe('summarizeChange', () => {
  it('lists changed fields on update', () => {
    const row: ChangelogRow = { ...base, table_name: 'people', action: 'update', before: { major: 'Econ', bio: null }, after: { major: 'Math', bio: null } }
    expect(summarizeChange(row)).toBe('people update: major "Econ" → "Math"')
  })
  it('describes inserts and deletes compactly', () => {
    const ins: ChangelogRow = { ...base, table_name: 'links', action: 'insert', before: null, after: { big_id: 'aaaaaaaa-0000-0000-0000-000000000001', little_id: 'bbbbbbbb-0000-0000-0000-000000000002', status: 'pending' } }
    expect(summarizeChange(ins)).toBe('links insert: big=aaaaaaaa little=bbbbbbbb pending')
    const del: ChangelogRow = { ...base, table_name: 'admins', action: 'delete', before: { person_id: 'cccccccc-0000-0000-0000-000000000003' }, after: null }
    expect(summarizeChange(del)).toBe('admins delete: person=cccccccc')
  })
  it('ignores updated_at noise', () => {
    const row: ChangelogRow = { ...base, table_name: 'people', action: 'update', before: { updated_at: '1', hidden: false }, after: { updated_at: '2', hidden: true } }
    expect(summarizeChange(row)).toBe('people update: hidden false → true')
  })
  it('names milestone changes', () => {
    const row: ChangelogRow = { ...base, table_name: 'lin_milestones', action: 'insert', before: null, after: { id: 'dddddddd-0000', title: '50th reunion' } }
    expect(summarizeChange(row)).toBe('lin_milestones insert: 50th reunion')
  })
})
