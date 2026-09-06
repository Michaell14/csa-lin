import type { LinGraph, GraphPerson } from '@/lib/types'

const P = (id: string, name: string | null, year: number, extra: Partial<GraphPerson> = {}): GraphPerson => ({
  id, display_name: name, grad_year: year, is_founder: false, placeholder: false,
  photo_path: null, major: null, hometown: null, bio: null, instagram: null, linkedin: null,
  claimed: true, ...extra,
})

export const ID = {
  founder: '00000000-0000-0000-0000-000000000001',
  big1: '00000000-0000-0000-0000-000000000002',
  big2: '00000000-0000-0000-0000-000000000003',
  child1: '00000000-0000-0000-0000-000000000004',
  child2: '00000000-0000-0000-0000-000000000005',
  shared: '00000000-0000-0000-0000-000000000006',
}

export const linAGraph: LinGraph = {
  people: [
    P(ID.founder, 'Founder A', 2020, { is_founder: true }),
    P(ID.big1, 'Big One', 2021),
    P(ID.big2, 'Big Two', 2021, { claimed: false }),
    P(ID.child1, 'Child One', 2022),
    P(ID.child2, 'Child Two', 2022),
    P(ID.shared, 'Shared Kid', 2023),
  ],
  links: [
    { id: 'l1', big_id: ID.founder, little_id: ID.big1, academic_year: '2020-21' },
    { id: 'l2', big_id: ID.founder, little_id: ID.big2, academic_year: '2020-21' },
    { id: 'l3', big_id: ID.big1, little_id: ID.child1, academic_year: '2021-22' },
    { id: 'l4', big_id: ID.big2, little_id: ID.child2, academic_year: '2021-22' },
    { id: 'l5', big_id: ID.child1, little_id: ID.shared, academic_year: '2022-23' },
  ],
}

export const hiddenFounderGraph: LinGraph = {
  people: [
    P(ID.founder, null, 2020, { is_founder: true, placeholder: true, claimed: null }),
    P(ID.big1, 'Big One', 2021),
  ],
  links: [{ id: 'l1', big_id: ID.founder, little_id: ID.big1, academic_year: null }],
}
