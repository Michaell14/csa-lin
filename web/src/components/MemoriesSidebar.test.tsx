import { render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoriesSidebar } from './MemoriesSidebar'

vi.mock('./LinMemories', () => ({ LinMemories: () => <div>timeline</div> }))
const lin = { id: 'lin', name: 'Dragons', color: '#123456', founder_id: 'founder' }
afterEach(() => vi.unstubAllEnvs())
it('renders nothing at all when memories are switched off', () => {
  vi.stubEnv('NEXT_PUBLIC_MEMORIES_ENABLED', 'false')
  const { container } = render(<MemoriesSidebar lin={lin} viewerKey="me" />)
  expect(container).toBeEmptyDOMElement()
})
it('offers the sidebar when memories are on', () => {
  vi.stubEnv('NEXT_PUBLIC_MEMORIES_ENABLED', 'true')
  render(<MemoriesSidebar lin={lin} viewerKey="me" />)
  expect(screen.getByRole('button', { name: 'Show memories' })).toBeInTheDocument()
})
