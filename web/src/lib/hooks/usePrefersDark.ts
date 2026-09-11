'use client'
import { useEffect, useState } from 'react'

const QUERY = '(prefers-color-scheme: dark)'

// The graph paints its edges on a canvas Tailwind can't reach, so it has to ask
// for the scheme directly — and follow it when the viewer switches mid-session.
export function usePrefersDark(): boolean {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia?.(QUERY)
    if (!mq) return
    setDark(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return dark
}
