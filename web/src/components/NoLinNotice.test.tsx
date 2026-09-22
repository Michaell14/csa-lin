import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NoLinNotice } from '@/components/NoLinNotice'

describe('NoLinNotice', () => {
  it('explains the empty lin and leads to the profile', () => {
    const onOpenProfile = vi.fn()
    render(<NoLinNotice onOpenProfile={onOpenProfile} />)
    expect(screen.getByRole('status')).toHaveTextContent('not in a lin yet')
    fireEvent.click(screen.getByRole('button', { name: 'Open my profile' }))
    expect(onOpenProfile).toHaveBeenCalledOnce()
  })
})
