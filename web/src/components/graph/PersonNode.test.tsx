import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ReactFlowProvider } from '@xyflow/react'
import { PersonNode } from '@/components/graph/PersonNode'
import { linAGraph, hiddenFounderGraph, ID } from '@/lib/testFixtures'

const wrap = (ui: React.ReactElement) => render(<ReactFlowProvider>{ui}</ReactFlowProvider>)
const data = (id: string, extra = {}) => ({
  person: linAGraph.people.find(p => p.id === id)!, photoUrl: null, selected: false, color: '#6366f1',
  sourcePorts: [], targetPorts: [], ...extra,
})

describe('PersonNode', () => {
  it('shows name and two-digit year', () => {
    wrap(<PersonNode data={data(ID.big1)} />)
    expect(screen.getByText('Big One')).toBeInTheDocument()
    expect(screen.getByText("'21")).toBeInTheDocument()
  })
  it('marks an unclaimed person with a dashed avatar', () => {
    wrap(<PersonNode data={data(ID.big2)} />)
    expect(screen.getByTestId('avatar')).toHaveAttribute('data-unclaimed', 'true')
  })
  it('gives an unclaimed pill a dashed border, off-white fill, and no halo', () => {
    wrap(<PersonNode data={data(ID.big2)} />)
    const pill = screen.getByTestId('pill')
    expect(pill).toHaveAttribute('data-unclaimed', 'true')
    expect(pill).toHaveStyle({ borderStyle: 'dashed', borderColor: '#6366f1' })
    expect(pill.style.boxShadow).toBe('')
    expect(pill.className).toContain('bg-surface-muted')
  })
  it('keeps the claimed pill solid and white, with the year colour on the border', () => {
    wrap(<PersonNode data={data(ID.big1)} />)
    const pill = screen.getByTestId('pill')
    expect(pill).toHaveAttribute('data-unclaimed', 'false')
    expect(pill).toHaveStyle({ borderColor: '#6366f1' })
    expect(pill.style.borderStyle).toBe('')
    expect(pill.style.boxShadow).toBe('')
    expect(pill.className).toContain('bg-white')
  })
  it('lets selection win over the unclaimed fill, adding a halo in the year colour', () => {
    wrap(<PersonNode data={data(ID.big2, { selected: true })} />)
    const pill = screen.getByTestId('pill')
    expect(pill).toHaveStyle({ borderStyle: 'dashed' })
    expect(pill.style.boxShadow).toContain('#6366f1')
    expect(pill.className).toContain('bg-surface-hover')
    expect(pill.className).not.toContain('bg-surface-muted')
  })
  it('renders a photo when a url is given', () => {
    wrap(<PersonNode data={data(ID.big1, { photoUrl: 'https://x/1' })} />)
    expect(screen.getByRole('img', { name: 'Big One' })).toHaveAttribute('src', 'https://x/1')
  })
  it('renders a hidden placeholder as a question mark without a year', () => {
    wrap(<PersonNode data={{ person: hiddenFounderGraph.people[0], photoUrl: null, selected: false, color: '#000000', sourcePorts: [], targetPorts: [] }} />)
    expect(screen.getByText('?')).toBeInTheDocument()
    expect(screen.queryByText('Founder')).not.toBeInTheDocument()
    expect(screen.queryByTestId('avatar')).not.toBeInTheDocument()
  })
  it('exposes selection state', () => {
    wrap(<PersonNode data={data(ID.big1, { selected: true })} />)
    expect(screen.getByTestId('pill')).toHaveAttribute('aria-pressed', 'true')
  })
})
