import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PhotoCropper } from '@/components/panel/PhotoCropper'
import { INITIAL_CROP, type CropState } from '@/lib/photoCrop'

const photo = { url: 'blob:photo', width: 800, height: 400 }

describe('PhotoCropper', () => {
  it('positions the picture with the crop transform', () => {
    render(<PhotoCropper photo={photo} state={{ rotation: 90, zoom: 2, offset: { x: 10, y: -5 } }} onChange={vi.fn()} />)
    const img = screen.getByRole('img', { name: /Photo preview/ }).querySelector('img')!
    expect(img.style.transform).toBe('translate(10px, -5px) rotate(90deg) scale(1.2)')
    expect(img).toHaveAttribute('src', 'blob:photo')
  })
  it('rotates a quarter turn either way', () => {
    const onChange = vi.fn()
    render(<PhotoCropper photo={photo} state={INITIAL_CROP} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Rotate right' }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ rotation: 90 }))
    fireEvent.click(screen.getByRole('button', { name: 'Rotate left' }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ rotation: 270 }))
  })
  it('zooms with the slider', () => {
    const onChange = vi.fn()
    render(<PhotoCropper photo={photo} state={INITIAL_CROP} onChange={onChange} />)
    fireEvent.change(screen.getByRole('slider', { name: 'Zoom' }), { target: { value: '2' } })
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ zoom: 2 }))
  })
  it('drags the picture and keeps it covering the square', () => {
    const onChange = vi.fn()
    render(<PhotoCropper photo={photo} state={INITIAL_CROP} onChange={onChange} />)
    const viewport = screen.getByRole('img', { name: /Photo preview/ })
    fireEvent.pointerDown(viewport, { pointerId: 1, clientX: 100, clientY: 100, button: 0 })
    fireEvent.pointerMove(viewport, { pointerId: 1, clientX: 130, clientY: 150 })
    // 800x400 at zoom 1 has horizontal slack only; the vertical drag is clamped away.
    expect(onChange).toHaveBeenLastCalledWith({ ...INITIAL_CROP, offset: { x: 30, y: 0 } })
    fireEvent.pointerUp(viewport, { pointerId: 1 })
    fireEvent.pointerMove(viewport, { pointerId: 1, clientX: 200, clientY: 150 })
    expect(onChange).toHaveBeenCalledTimes(1)
  })
  it('nudges with the arrow keys', () => {
    const onChange = vi.fn()
    const state: CropState = { ...INITIAL_CROP, offset: { x: 0, y: 0 } }
    render(<PhotoCropper photo={photo} state={state} onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('img', { name: /Photo preview/ }), { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenLastCalledWith({ ...state, offset: { x: -8, y: 0 } })
  })
})
