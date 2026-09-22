import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { GraphPerson, Lin, LinGraph } from '@/lib/types'
import { LinOverview } from '@/components/LinOverview'

const person = (id: string, display_name: string | null, extra: Partial<GraphPerson> = {}): GraphPerson => ({
  id, display_name, grad_year: 2025, is_founder: false, placeholder: false, photo_path: null,
  major: null, hometown: null, bio: null, instagram: null, linkedin: null, claimed: true, ...extra,
})

const lin: Lin = { id: 'lin-1', name: 'Dragons', color: '#c63d2f', founder_id: 'f' }
const props = { lin, view: 'graph' as const, hasSelf: false, onView: vi.fn(), onFounder: vi.fn(), onSelf: vi.fn() }
const withPeople = (people: GraphPerson[]): LinGraph => ({ people, links: [] })

describe('LinOverview', () => {
  it('offers the founder shortcut when the founder has a profile', () => {
    render(<LinOverview {...props} graph={withPeople([person('f', 'Ada Founder', { is_founder: true })])} membersStatus="ready" />)
    expect(screen.getByRole('button', { name: 'Founder' })).toBeInTheDocument()
  })

  it('hides the founder shortcut when the founder is only a placeholder', () => {
    render(<LinOverview {...props} graph={withPeople([person('f', null, { is_founder: true, placeholder: true })])} membersStatus="ready" />)
    expect(screen.queryByRole('button', { name: 'Founder' })).not.toBeInTheDocument()
  })

  it('hides the founder shortcut when the founder is not in the graph at all', () => {
    render(<LinOverview {...props} graph={withPeople([person('someone-else', 'Bea')])} membersStatus="ready" />)
    expect(screen.queryByRole('button', { name: 'Founder' })).not.toBeInTheDocument()
  })

  it('says it is loading instead of reporting a lin as empty', () => {
    render(<LinOverview {...props} graph={withPeople([])} membersStatus="loading" />)
    expect(screen.getByText('Loading members…')).toBeInTheDocument()
    expect(screen.queryByText(/0 members/)).not.toBeInTheDocument()
    expect(screen.queryByText(/No members yet/)).not.toBeInTheDocument()
  })

  it('stops claiming to load once the request has failed', () => {
    render(<LinOverview {...props} graph={withPeople([])} membersStatus="unavailable" />)
    expect(screen.getByText('Members unavailable')).toBeInTheDocument()
    expect(screen.queryByText('Loading members…')).not.toBeInTheDocument()
    expect(screen.queryByText(/0 members/)).not.toBeInTheDocument()
  })

  it('offers the lin editor only to someone who may edit', () => {
    const onEdit = vi.fn()
    const { rerender } = render(<LinOverview {...props} graph={withPeople([])} membersStatus="ready" canEdit onEdit={onEdit} />)
    screen.getByRole('button', { name: 'Edit lin' }).click()
    expect(onEdit).toHaveBeenCalledOnce()
    rerender(<LinOverview {...props} graph={withPeople([])} membersStatus="ready" canEdit={false} onEdit={onEdit} />)
    expect(screen.queryByRole('button', { name: 'Edit lin' })).not.toBeInTheDocument()
  })

  it('counts the members once the lin has loaded', () => {
    render(<LinOverview {...props} graph={withPeople([person('a', 'Ann'), person('b', 'Ben', { grad_year: 2027 })])} membersStatus="ready" />)
    expect(screen.getByText('2 members · Classes 2025–2027')).toBeInTheDocument()
  })

  it('leaves out the class span when every member hides their year', () => {
    render(<LinOverview {...props} graph={withPeople([person('a', 'Ann', { grad_year: null })])} membersStatus="ready" />)
    expect(screen.getByText('1 member')).toBeInTheDocument()
  })

  it('says an empty lin is empty instead of counting it', () => {
    render(<LinOverview {...props} graph={withPeople([])} membersStatus="ready" />)
    expect(screen.getByText('No members yet')).toBeInTheDocument()
    expect(screen.queryByText(/0 members/)).not.toBeInTheDocument()
  })
})
