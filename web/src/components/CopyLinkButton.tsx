'use client'
import { useEffect, useRef, useState } from 'react'
import { CheckIcon, LinkIcon } from '@/components/icons'

// Puts a link to the current lin or person on the clipboard: the URL already
// says which is open, so sharing is only a matter of copying it. The button
// confirms for a moment, then offers again; a browser that refuses every way
// of copying gets a plain message.

// The clipboard API first; where a browser denies it (embedded views, some
// permission policies), the older path of selecting a hidden field and
// issuing the copy command still works inside a click.
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const field = document.createElement('textarea')
    field.value = text
    field.setAttribute('readonly', '')
    field.style.position = 'fixed'
    field.style.opacity = '0'
    document.body.appendChild(field)
    field.select()
    let copied = false
    try { copied = document.execCommand('copy') } catch { copied = false }
    field.remove()
    return copied
  }
}
export function CopyLinkButton({ path, label, className = 'btn-sm' }: {
  // Path and query of the page to share, e.g. `/?lin=…&person=…`.
  path: string
  // What is being shared, for the accessible name: "Copy link to this lin".
  label: string
  className?: string
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  async function copy() {
    if (timer.current) clearTimeout(timer.current)
    setState(await copyText(`${window.location.origin}${path}`) ? 'copied' : 'failed')
    timer.current = setTimeout(() => setState('idle'), 2000)
  }

  return (
    <button type="button" onClick={() => { void copy() }} className={className}
      aria-label={state === 'copied' ? 'Link copied' : state === 'failed' ? 'Could not copy link' : `Copy link to this ${label}`}>
      {state === 'copied' ? <><CheckIcon size={14} />Copied</> : state === 'failed' ? 'Copy failed' : <><LinkIcon size={14} /><span className="sm:hidden">Link</span><span className="hidden sm:inline">Copy link</span></>}
    </button>
  )
}
