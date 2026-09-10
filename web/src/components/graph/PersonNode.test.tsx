import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ReactFlowProvider } from '@xyflow/react'
import { PersonNode } from '@/components/graph/PersonNode'
import { linAGraph, hiddenFounderGraph, ID } from '@/lib/testFixtures'

const wrap = (ui: React.ReactElement) => render(<ReactFlowProvider>{ui}</ReactFlowProvider>)
const data = (id: string, extra = {}) => ({
  person: linAGraph.people.find(p => p.id === id)!, photoUrl: null, selected: false, dimmed: false, color: '#6366f1', ...extra,
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
  it('renders a photo when a url is given', () => {
    wrap(<PersonNode data={data(ID.big1, { photoUrl: 'https://x/1' })} />)
    expect(screen.getByRole('img', { name: 'Big One' })).toHaveAttribute('src', 'https://x/1')
  })
  it('renders a placeholder founder without a name', () => {
    wrap(<PersonNode data={{ person: hiddenFounderGraph.people[0], photoUrl: null, selected: false, dimmed: false, color: '#000000' }} />)
    expect(screen.getByText('Founder')).toBeInTheDocument()
  })
  it('exposes selection state', () => {
    wrap(<PersonNode data={data(ID.big1, { selected: true })} />)
    expect(screen.getByTestId('pill')).toHaveAttribute('aria-pressed', 'true')
  })
  it('is a button a keyboard can reach, named for the person', () => {
    wrap(<PersonNode data={data(ID.big2)} />)
    const pill = screen.getByRole('button', { name: 'Big Two, class of 2021, profile not claimed' })
    expect(pill).toBe(screen.getByTestId('pill'))
  })
  it('fades a person who is off the selected line', () => {
    wrap(<PersonNode data={data(ID.big1, { dimmed: true })} />)
    expect(screen.getByTestId('pill')).toHaveStyle({ opacity: '0.3' })
  })
})
