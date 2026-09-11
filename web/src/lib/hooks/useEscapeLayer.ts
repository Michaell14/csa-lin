'use client'
import { useEffect, useRef } from 'react'

type Handler = () => void
type Layer = { current: Handler }

// Dismissible layers (a menu, the person panel, an open search list) each used
// to own a window-level Escape listener, so one key press dismissed all of them
// at once. They share this stack instead: the most recently opened layer is the
// topmost one, and only it sees the key.
const stack: Layer[] = []
let listening = false

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  const top = stack[stack.length - 1]
  if (!top) return
  e.preventDefault()
  top.current()
}

/** Own Escape while `active`, unless a layer opened later is sitting on top. */
export function useEscapeLayer(active: boolean, handler: Handler) {
  const layer = useRef(handler)
  layer.current = handler

  useEffect(() => {
    if (!active) return
    const mine = layer
    stack.push(mine)
    if (!listening) { window.addEventListener('keydown', onKeyDown); listening = true }
    return () => {
      const i = stack.lastIndexOf(mine)
      if (i !== -1) stack.splice(i, 1)
      if (listening && stack.length === 0) { window.removeEventListener('keydown', onKeyDown); listening = false }
    }
  }, [active])
}
