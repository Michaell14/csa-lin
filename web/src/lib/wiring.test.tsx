import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import type { Database } from '@/lib/database.types'

type PeopleRow = Database['public']['Tables']['people']['Row']

describe('test wiring', () => {
  it('renders with Testing Library and resolves the @ alias', () => {
    const sample: Pick<PeopleRow, 'display_name'> = { display_name: 'Alice' }
    render(<p>{sample.display_name}</p>)
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })
})
