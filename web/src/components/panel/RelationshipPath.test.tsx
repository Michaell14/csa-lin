import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { GraphPerson, LinGraph } from '@/lib/types'
import { RelationshipPath } from '@/components/panel/RelationshipPath'

const P = (id: string, name: string | null, extra: Partial<GraphPerson> = {}): GraphPerson => ({
  id, display_name: name, grad_year: 2025, is_founder: false, placeholder: false,
  photo_path: null, major: null, hometown: null, bio: null, instagram: null, linkedin: null,
  claimed: true, ...extra,
})

// me → founder → them, where the founder is an unnamed placeholder and `ghost`
// is linked but hidden from this viewer, so it never reaches `graph.people`.
const graph: LinGraph = {
  people: [P('me', 'Me'), P('founder', null, { is_founder: true, placeholder: true, claimed: null }), P('them', 'Them')],
  links: [
    { id: 'l1', big_id: 'founder', little_id: 'me', academic_year: null },
    { id: 'l2', big_id: 'founder', little_id: 'them', academic_year: null },
  ],
}

describe('RelationshipPath', () => {
  it('opens people who have a profile to show', async () => {
    const onSelectPerson = vi.fn()
    render(<RelationshipPath graph={graph} path={{ personIds: ['me', 'founder', 'them'], linkIds: ['l1', 'l2'] }} onSelectPerson={onSelectPerson} />)
    await userEvent.click(screen.getByRole('button', { name: 'Them' }))
    expect(onSelectPerson).toHaveBeenCalledWith('them')
  })

  it('renders a placeholder founder as a label, not a button', () => {
    render(<RelationshipPath graph={graph} path={{ personIds: ['me', 'founder', 'them'], linkIds: ['l1', 'l2'] }} onSelectPerson={vi.fn()} />)
    expect(screen.getByText('Founder')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Founder' })).not.toBeInTheDocument()
  })

  it('renders someone missing from the graph as a hidden label', () => {
    render(<RelationshipPath graph={graph} path={{ personIds: ['me', 'ghost', 'them'], linkIds: ['l1', 'l2'] }} onSelectPerson={vi.fn()} />)
    expect(screen.getByText('Hidden member')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hidden member' })).not.toBeInTheDocument()
  })
})
