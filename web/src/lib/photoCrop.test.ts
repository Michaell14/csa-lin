import { describe, it, expect } from 'vitest'
import {
  INITIAL_CROP, MAX_ZOOM, MIN_ZOOM, clampOffset, coverScale, outputSize, outputType, pan, previewTransform,
  rotate, rotatedSize, setZoom, type CropState,
} from '@/lib/photoCrop'

const landscape = { width: 800, height: 400 }
const V = 240

describe('photoCrop geometry', () => {
  it('swaps the sides for quarter turns', () => {
    expect(rotatedSize(landscape, 0)).toEqual(landscape)
    expect(rotatedSize(landscape, 90)).toEqual({ width: 400, height: 800 })
    expect(rotatedSize(landscape, 180)).toEqual(landscape)
    expect(rotatedSize(landscape, 270)).toEqual({ width: 400, height: 800 })
  })
  it('scales the shorter edge to fill the viewport at zoom 1', () => {
    expect(coverScale(landscape, 0, V)).toBeCloseTo(0.6)
    expect(coverScale(landscape, 90, V)).toBeCloseTo(0.6)
    expect(coverScale({ width: 100, height: 100 }, 0, V)).toBeCloseTo(2.4)
  })
  it('keeps the picture covering the viewport when panning', () => {
    // 800x400 at 0.6 is 480x240: 120px of slack either side horizontally, none vertically.
    expect(clampOffset(landscape, { ...INITIAL_CROP, offset: { x: 500, y: 50 } }, V)).toEqual({ x: 120, y: 0 })
    expect(clampOffset(landscape, { ...INITIAL_CROP, offset: { x: -500, y: -50 } }, V)).toEqual({ x: -120, y: 0 })
    expect(pan(landscape, INITIAL_CROP, { x: 30, y: -5 }, V).offset).toEqual({ x: 30, y: 0 })
    // Rotated, the slack moves to the vertical axis.
    expect(clampOffset(landscape, { ...INITIAL_CROP, rotation: 90, offset: { x: 500, y: 500 } }, V)).toEqual({ x: 0, y: 120 })
  })
  it('zooms about the centre and clamps the range', () => {
    const zoomed = setZoom(landscape, { ...INITIAL_CROP, offset: { x: 60, y: 0 } }, 2, V)
    expect(zoomed.zoom).toBe(2)
    expect(zoomed.offset).toEqual({ x: 120, y: 0 })
    expect(setZoom(landscape, INITIAL_CROP, 99, V).zoom).toBe(MAX_ZOOM)
    expect(setZoom(landscape, INITIAL_CROP, 0, V).zoom).toBe(MIN_ZOOM)
    expect(setZoom(landscape, INITIAL_CROP, Number.NaN, V).zoom).toBe(MIN_ZOOM)
    // Zooming back out pulls an offset that no longer fits back inside the bounds.
    expect(setZoom(landscape, zoomed, 1, V).offset).toEqual({ x: 60, y: 0 })
  })
  it('rotates in both directions and wraps around', () => {
    let s: CropState = INITIAL_CROP
    for (const expected of [90, 180, 270, 0]) { s = rotate(landscape, s, 1, V); expect(s.rotation).toBe(expected) }
    expect(rotate(landscape, INITIAL_CROP, -1, V).rotation).toBe(270)
  })
  it('turns the offset with the picture so the same content stays in view', () => {
    const state: CropState = { rotation: 0, zoom: 2, offset: { x: 40, y: -20 } }
    expect(rotate(landscape, state, 1, V).offset).toEqual({ x: 20, y: 40 })
    expect(rotate(landscape, state, -1, V).offset).toEqual({ x: -20, y: -40 })
    expect(rotate(landscape, rotate(landscape, state, 1, V), -1, V)).toEqual(state)
  })
  it('describes the preview as a CSS transform', () => {
    expect(previewTransform(landscape, { rotation: 90, zoom: 2, offset: { x: 10, y: -5 } }, V)).toBe('translate(10px, -5px) rotate(90deg) scale(1.2)')
  })
  it('exports the visible square at source resolution, capped and never upscaled', () => {
    expect(outputSize(landscape, INITIAL_CROP, V)).toBe(400)
    expect(outputSize(landscape, { ...INITIAL_CROP, zoom: 2 }, V)).toBe(200)
    expect(outputSize({ width: 100, height: 100 }, INITIAL_CROP, V)).toBe(100)
    expect(outputSize({ width: 5000, height: 5000 }, INITIAL_CROP, V)).toBe(1024)
    expect(outputSize({ width: 5000, height: 5000 }, { ...INITIAL_CROP, zoom: 4 }, V)).toBe(1024)
  })
  it('keeps PNG and converts everything else to JPEG', () => {
    expect(outputType('image/png')).toBe('image/png')
    expect(outputType('image/webp')).toBe('image/jpeg')
    expect(outputType('image/jpeg')).toBe('image/jpeg')
  })
})
