/**
 * Geometry for the profile-photo cropper. The preview shows the picture inside
 * a square viewport; the member rotates it in quarter turns, zooms it, and
 * drags it about. The same transform (translate, then rotate, then scale,
 * about the picture's centre) drives both the CSS preview and the canvas
 * export, so what is saved is exactly what was shown.
 */
import { MAX_BYTES, MAX_EDGE } from '@/lib/api/photos'

export type Rotation = 0 | 90 | 180 | 270
export type CropState = { rotation: Rotation; zoom: number; offset: { x: number; y: number } }
export type Size = { width: number; height: number }

/** Side of the square preview, in CSS pixels. */
export const VIEWPORT = 240
export const MIN_ZOOM = 1
export const MAX_ZOOM = 4

export const INITIAL_CROP: CropState = { rotation: 0, zoom: 1, offset: { x: 0, y: 0 } }

/** Bounding box of the picture after a quarter-turn rotation. */
export function rotatedSize(size: Size, rotation: Rotation): Size {
  return rotation % 180 === 0 ? { ...size } : { width: size.height, height: size.width }
}

/** Scale at zoom 1: the picture's shorter edge exactly fills the viewport. */
export function coverScale(size: Size, rotation: Rotation, viewport = VIEWPORT): number {
  const r = rotatedSize(size, rotation)
  return viewport / Math.min(r.width, r.height)
}

/** Preview pixels per picture pixel for the given state. */
export function displayScale(size: Size, state: CropState, viewport = VIEWPORT): number {
  return coverScale(size, state.rotation, viewport) * state.zoom
}

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return MIN_ZOOM
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

/**
 * Keeps the picture covering the whole viewport: an offset may move it only as
 * far as its scaled edge stays outside the viewport's edge on every side.
 */
export function clampOffset(size: Size, state: CropState, viewport = VIEWPORT): { x: number; y: number } {
  const s = displayScale(size, state, viewport)
  const r = rotatedSize(size, state.rotation)
  const maxX = Math.max(0, (r.width * s - viewport) / 2)
  const maxY = Math.max(0, (r.height * s - viewport) / 2)
  // `+ 0` turns a -0 into 0 so the CSS never reads "-0px" and tests compare cleanly.
  return { x: Math.min(maxX, Math.max(-maxX, state.offset.x)) + 0, y: Math.min(maxY, Math.max(-maxY, state.offset.y)) + 0 }
}

/** A state with its zoom and offset brought back within bounds. */
export function normalizeCrop(size: Size, state: CropState, viewport = VIEWPORT): CropState {
  const zoomed = { ...state, zoom: clampZoom(state.zoom) }
  return { ...zoomed, offset: clampOffset(size, zoomed, viewport) }
}

/** Rotate a quarter turn, keeping the same part of the picture in view (the offset turns with it). */
export function rotate(size: Size, state: CropState, direction: 1 | -1, viewport = VIEWPORT): CropState {
  const rotation = (((state.rotation + direction * 90) % 360) + 360) % 360 as Rotation
  const { x, y } = state.offset
  const offset = direction === 1 ? { x: -y, y: x } : { x: y, y: -x }
  return normalizeCrop(size, { ...state, rotation, offset }, viewport)
}

/** Change zoom about the viewport centre: the offset scales with it so the centred content stays put. */
export function setZoom(size: Size, state: CropState, zoom: number, viewport = VIEWPORT): CropState {
  const next = clampZoom(zoom)
  const factor = next / state.zoom
  return normalizeCrop(size, { ...state, zoom: next, offset: { x: state.offset.x * factor, y: state.offset.y * factor } }, viewport)
}

export function pan(size: Size, state: CropState, offset: { x: number; y: number }, viewport = VIEWPORT): CropState {
  return normalizeCrop(size, { ...state, offset }, viewport)
}

/**
 * CSS transform for an <img> laid out at its natural size and centred in the
 * viewport. Applied right to left: scale about the centre, rotate, then shift.
 */
export function previewTransform(size: Size, state: CropState, viewport = VIEWPORT): string {
  const s = displayScale(size, state, viewport)
  return `translate(${state.offset.x}px, ${state.offset.y}px) rotate(${state.rotation}deg) scale(${s})`
}

/**
 * Side of the exported square in picture pixels: what the viewport shows,
 * capped at MAX_EDGE and never upscaled.
 */
export function outputSize(size: Size, state: CropState, viewport = VIEWPORT, maxEdge = MAX_EDGE): number {
  const s = displayScale(size, state, viewport)
  return Math.max(1, Math.min(maxEdge, Math.round(viewport / s)))
}

/** The stored format: PNG keeps transparency; everything else becomes JPEG. */
export function outputType(sourceType: string): 'image/png' | 'image/jpeg' {
  return sourceType === 'image/png' ? 'image/png' : 'image/jpeg'
}

export type LoadedPhoto = Size & { file: File; url: string; image: CanvasImageSource; revoke: () => void }

/** Decodes a picked file for preview and export. Rejects when the browser cannot read it as an image. */
export function loadPhoto(file: File): Promise<LoadedPhoto> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve({ file, url, image: img, width: img.naturalWidth, height: img.naturalHeight, revoke: () => URL.revokeObjectURL(url) })
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file is not a readable image')) }
    img.src = url
  })
}

/** Draws the viewport's contents at output resolution and encodes them. */
export function renderCrop(photo: LoadedPhoto, state: CropState, viewport = VIEWPORT): Promise<File> {
  const side = outputSize(photo, state, viewport)
  const type = outputType(photo.file.type)
  const canvas = document.createElement('canvas')
  canvas.width = side; canvas.height = side
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('Could not process that photo'))
  ctx.imageSmoothingQuality = 'high'
  const k = side / viewport
  const s = displayScale(photo, state, viewport)
  ctx.translate(side / 2, side / 2)
  ctx.scale(k, k)
  ctx.translate(state.offset.x, state.offset.y)
  ctx.rotate(state.rotation * Math.PI / 180)
  ctx.scale(s, s)
  ctx.drawImage(photo.image, -photo.width / 2, -photo.height / 2, photo.width, photo.height)
  const encode = (as: 'image/png' | 'image/jpeg') => new Promise<File>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) { reject(new Error('Could not process that photo')); return }
      resolve(new File([blob], `avatar.${as === 'image/png' ? 'png' : 'jpg'}`, { type: as }))
    }, as, 0.92)
  })
  // A photographic PNG can outgrow the upload limit once cropped at full
  // resolution; JPEG brings it back under rather than failing the save.
  return encode(type).then(file => (type === 'image/png' && file.size > MAX_BYTES ? encode('image/jpeg') : file))
}
