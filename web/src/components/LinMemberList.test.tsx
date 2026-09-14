import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { GraphPerson, LinGraph } from '@/lib/types'
import { groupPeopleByYear, LinMemberList } from '@/components/LinMemberList'

const person = (id: string, display_name: string, grad_year: number): GraphPerson => ({
  id, display_name, grad_year, is_founder: id === 'a', placeholder: false, photo_path: null,
  major: null, hometown: null, bio: null, instagram: null, linkedin: null, claimed: true,
})

describe('LinMemberList', () => {
  const people = [person('c', 'Charlie', 2026), person('b', 'Bea', 2025), person('a', 'Alex', 2025)]

  it('groups by ascending class year and sorts names', () => {
    expect(groupPeopleByYear(people).map(([year, members]) => [year, members.map(p => p.display_name)]))
      .toEqual([[2025, ['Alex', 'Bea']], [2026, ['Charlie']]])
  })

  it('opens a member from the accessible list view', () => {
    const onSelect = vi.fn()
    render(<LinMemberList graph={{ people, links: [] } satisfies LinGraph} photoUrls={new Map()} selectedId={null} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Charlie'))
    expect(onSelect).toHaveBeenCalledWith('c')
    expect(screen.getByRole('heading', { name: 'Class of 2025' })).toBeInTheDocument()
  })

  it('renders placeholder founder without duplicate label', () => {
    const placeholderFounder: GraphPerson = {
      ...person('pf', '', 2024),
      placeholder: true,
      is_founder: true,
    }
    render(<LinMemberList graph={{ people: [placeholderFounder], links: [] }} photoUrls={new Map()} selectedId={null} onSelect={vi.fn()} />)
    expect(screen.getByText('Founder')).toBeInTheDocument()
    expect(screen.queryByText('Founder · Founder')).not.toBeInTheDocument()
  })
})
