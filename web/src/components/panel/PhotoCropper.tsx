'use client'
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { MAX_ZOOM, MIN_ZOOM, VIEWPORT, pan, previewTransform, rotate, setZoom, type CropState, type Size } from '@/lib/photoCrop'
import { RotateLeftIcon, RotateRightIcon } from '@/components/icons'

const NUDGE = 8

/**
 * Square preview of a picked photo with drag-to-reposition, zoom and
 * quarter-turn rotation. The circle overlay shows the part of the square that
 * the round avatar will display; the whole square is what gets saved.
 */
export function PhotoCropper({ photo, state, onChange }: {
  photo: Size & { url: string }
  state: CropState
  onChange: (next: CropState) => void
}) {
  const drag = useRef<{ pointerId: number; startX: number; startY: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    drag.current = { pointerId: e.pointerId, startX: e.clientX - state.offset.x, startY: e.clientY - state.offset.y }
    setDragging(true)
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    onChange(pan(photo, state, { x: e.clientX - d.startX, y: e.clientY - d.startY }))
  }
  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId !== e.pointerId) return
    drag.current = null
    setDragging(false)
  }
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, [number, number]> = { ArrowLeft: [-NUDGE, 0], ArrowRight: [NUDGE, 0], ArrowUp: [0, -NUDGE], ArrowDown: [0, NUDGE] }
    const move = moves[e.key]
    if (!move) return
    e.preventDefault()
    onChange(pan(photo, state, { x: state.offset.x + move[0], y: state.offset.y + move[1] }))
  }

  return (
    <div className="flex flex-col gap-2">
      <div role="img" aria-label="Photo preview. Drag or use the arrow keys to reposition." tabIndex={0}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onKeyDown={onKeyDown}
        style={{ width: VIEWPORT, height: VIEWPORT }}
        className={`relative touch-none select-none overflow-hidden rounded-md bg-surface-muted shadow-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt="" draggable={false}
          style={{ position: 'absolute', left: VIEWPORT / 2 - photo.width / 2, top: VIEWPORT / 2 - photo.height / 2, width: photo.width, height: photo.height, maxWidth: 'none', transform: previewTransform(photo, state), transformOrigin: 'center' }} />
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_999px_rgba(255,255,255,0.55)]" />
      </div>
      <div className="flex items-center gap-2" style={{ width: VIEWPORT }}>
        <label className="flex min-w-0 grow items-center gap-2 text-xs text-ink-muted">
          <span>Zoom</span>
          <input type="range" min={MIN_ZOOM} max={MAX_ZOOM} step={0.01} value={state.zoom} aria-label="Zoom"
            onChange={e => onChange(setZoom(photo, state, Number(e.target.value)))} className="min-w-0 grow accent-accent" />
        </label>
        <button type="button" onClick={() => onChange(rotate(photo, state, -1))} aria-label="Rotate left" title="Rotate left" className="icon-btn"><RotateLeftIcon size={14} /></button>
        <button type="button" onClick={() => onChange(rotate(photo, state, 1))} aria-label="Rotate right" title="Rotate right" className="icon-btn"><RotateRightIcon size={14} /></button>
      </div>
    </div>
  )
}
