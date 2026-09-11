import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Person } from '@/lib/types'

const person = (id: string, name: string, year: number, extra: Partial<Person> = {}): Person => ({
  id, display_name: name, grad_year: year, penn_email: null, personal_email: null, auth_user_id: null, claimed_at: null,
  photo_path: null, major: null, hometown: null, bio: null, instagram: null, linkedin: null, hidden: false,
  merged_into: null, created_at: '', updated_at: '', ...extra,
})

const rows = vi.hoisted(() => ({ people: [] as unknown[] }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/lib/api/admin', () => ({
  listPeople: vi.fn(async () => rows.people),
  insertPeople: vi.fn(),
  adminUpdatePerson: vi.fn(),
}))
vi.mock('@/lib/api/people', () => ({ searchPeople: vi.fn(async () => []) }))

import { PeopleTable, sortPeople, type Sort } from '@/components/admin/PeopleTable'

const names = () => screen.getAllByRole('row').slice(1).map(r => within(r).getAllByRole('cell')[0].textContent)

describe('sortPeople', () => {
  const people = [person('1', 'Bea', 2024), person('2', 'Al', 2022), person('3', 'Cy', 2026, { penn_email: 'cy@upenn.edu' })]
  const by = (sort: Sort) => sortPeople(people, sort).map(p => p.display_name)

  it('orders by a column in both directions', () => {
    expect(by({ key: 'display_name', dir: 'asc' })).toEqual(['Al', 'Bea', 'Cy'])
    expect(by({ key: 'display_name', dir: 'desc' })).toEqual(['Cy', 'Bea', 'Al'])
    expect(by({ key: 'grad_year', dir: 'desc' })).toEqual(['Cy', 'Bea', 'Al'])
  })
  it('keeps rows with no value at the end whichever way it sorts', () => {
    expect(by({ key: 'penn_email', dir: 'asc' })[0]).toBe('Cy')
    expect(by({ key: 'penn_email', dir: 'desc' })[0]).toBe('Cy')
  })
  it('does not mutate what it was given', () => {
    const before = people.map(p => p.id)
    sortPeople(people, { key: 'display_name', dir: 'desc' })
    expect(people.map(p => p.id)).toEqual(before)
  })
})

describe('PeopleTable', () => {
  beforeEach(() => { rows.people = [person('1', 'Bea', 2024), person('2', 'Al', 2022), person('3', 'Cy', 2026)] })

  it('sorts by a column header and flips on a second click', async () => {
    render(<PeopleTable />)
    await waitFor(() => expect(names()).toEqual(['Cy', 'Bea', 'Al']))

    fireEvent.click(screen.getByRole('button', { name: /Name/ }))
    expect(names()).toEqual(['Al', 'Bea', 'Cy'])
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'ascending')

    fireEvent.click(screen.getByRole('button', { name: /Name/ }))
    expect(names()).toEqual(['Cy', 'Bea', 'Al'])
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'descending')
  })

  it('pages through a long list and says where you are', async () => {
    rows.people = Array.from({ length: 60 }, (_, i) => person(String(i), `Person ${String(i).padStart(2, '0')}`, 2020 + (i % 5)))
    render(<PeopleTable />)
    await waitFor(() => expect(screen.getByText('Showing 1–25 of 60')).toBeInTheDocument())
    expect(names()).toHaveLength(25)
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Showing 26–50 of 60')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Showing 51–60 of 60')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('returns to the first page when the sort changes', async () => {
    rows.people = Array.from({ length: 60 }, (_, i) => person(String(i), `Person ${String(i).padStart(2, '0')}`, 2020 + (i % 5)))
    render(<PeopleTable />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Showing 26–50 of 60')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Name/ }))
    expect(screen.getByText('Showing 1–25 of 60')).toBeInTheDocument()
  })

  it('hides the pager for a list that fits on one page', async () => {
    render(<PeopleTable />)
    await waitFor(() => expect(names()).toHaveLength(3))
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull()
  })

  it('says when a filter matches nobody', async () => {
    rows.people = []
    render(<PeopleTable />)
    expect(await screen.findByText('No people yet. Add the first one above.')).toBeInTheDocument()
  })
})
