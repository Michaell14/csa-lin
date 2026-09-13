import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ReactFlowProvider } from '@xyflow/react'
import { PersonNode } from '@/components/graph/PersonNode'
import { linAGraph, hiddenFounderGraph, ID } from '@/lib/testFixtures'

const wrap = (ui: React.ReactElement) => render(<ReactFlowProvider>{ui}</ReactFlowProvider>)
const data = (id: string, extra = {}) => ({
  person: linAGraph.people.find(p => p.id === id)!, photoUrl: null, selected: false, color: '#6366f1', ...extra,
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
  it('gives an unclaimed pill a dashed border, cream fill, and no shadow', () => {
    wrap(<PersonNode data={data(ID.big2)} />)
    const pill = screen.getByTestId('pill')
    expect(pill).toHaveAttribute('data-unclaimed', 'true')
    expect(pill).toHaveStyle({ borderStyle: 'dashed', boxShadow: 'none' })
    expect(pill.className).toContain('bg-cream')
  })
  it('keeps the claimed pill solid, white, and shadowed', () => {
    wrap(<PersonNode data={data(ID.big1)} />)
    const pill = screen.getByTestId('pill')
    expect(pill).toHaveAttribute('data-unclaimed', 'false')
    expect(pill).toHaveStyle({ boxShadow: '3px 3px 0 #6366f1' })
    expect(pill.className).toContain('bg-white')
  })
  it('lets selection win over the unclaimed fill and shadow', () => {
    wrap(<PersonNode data={data(ID.big2, { selected: true })} />)
    const pill = screen.getByTestId('pill')
    expect(pill).toHaveStyle({ borderStyle: 'dashed', boxShadow: '5px 5px 0 #6366f1' })
    expect(pill.className).toContain('bg-gold')
  })
  it('renders a photo when a url is given', () => {
    wrap(<PersonNode data={data(ID.big1, { photoUrl: 'https://x/1' })} />)
    expect(screen.getByRole('img', { name: 'Big One' })).toHaveAttribute('src', 'https://x/1')
  })
  it('renders a placeholder founder without a name', () => {
    wrap(<PersonNode data={{ person: hiddenFounderGraph.people[0], photoUrl: null, selected: false, color: '#000000' }} />)
    expect(screen.getByText('Founder')).toBeInTheDocument()
  })
  it('exposes selection state', () => {
    wrap(<PersonNode data={data(ID.big1, { selected: true })} />)
    expect(screen.getByTestId('pill')).toHaveAttribute('aria-pressed', 'true')
  })
})
