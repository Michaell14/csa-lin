'use client'
import { useState } from 'react'
import { mediaKind } from '@/lib/api/memories'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'

/**
 * One item of a memory at a time. Only the current item is in the DOM, so the
 * others are not downloaded until viewed, which keeps egress flat next to a
 * single-photo post. Arrows and dots move; ArrowLeft/ArrowRight work while the
 * group has focus. Nothing wraps, so the ends are obvious.
 */
export function MemorySlideshow({ paths, urls, alt }: { paths: string[]; urls: (string | null)[]; alt: string }) {
  const [index, setIndex] = useState(0)
  const count = paths.length
  const url = urls[index]
  const go = (next: number) => setIndex(Math.min(count - 1, Math.max(0, next)))
  const label = `${alt} (${index + 1} of ${count})`
  const arrow = 'absolute top-1/2 -translate-y-1/2 rounded-full border border-line bg-white/90 p-1.5 text-ink shadow-sm hover:bg-white focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-30'
  return <div role="group" aria-label={`${alt}, ${count} items`} tabIndex={0}
    onKeyDown={event => {
      if (event.key === 'ArrowLeft') { event.preventDefault(); go(index - 1) }
      if (event.key === 'ArrowRight') { event.preventDefault(); go(index + 1) }
    }}
    className="focus-visible:outline-2 focus-visible:outline-accent">
    <div data-testid="memory-media-frame" className="relative flex h-72 w-full items-center justify-center bg-black">
      {url ? mediaKind(paths[index]) === 'video'
        ? <video key={paths[index]} controls playsInline preload="metadata" src={url} aria-label={label} className="h-full w-full object-contain" />
        /* eslint-disable-next-line @next/next/no-img-element */
        : <img key={paths[index]} loading="lazy" src={url} alt={label} className="photo h-full w-full object-contain" />
        : <p className="p-6 text-sm text-white">Media unavailable. Refresh the timeline to try again.</p>}
      <button type="button" aria-label="Previous" disabled={index === 0} onClick={() => go(index - 1)} className={`${arrow} left-2`}><ChevronLeftIcon size={18} /></button>
      <button type="button" aria-label="Next" disabled={index === count - 1} onClick={() => go(index + 1)} className={`${arrow} right-2`}><ChevronRightIcon size={18} /></button>
    </div>
    <div className="flex items-center justify-center gap-2 py-2">
      <span className="text-xs tabular-nums text-ink-muted">{index + 1} of {count}</span>
      <div className="flex gap-1.5">{paths.map((path, i) => <button key={path} type="button" aria-label={`Go to item ${i + 1}`} aria-current={i === index || undefined} onClick={() => go(i)} className={`h-2 w-2 rounded-full ${i === index ? 'bg-ink' : 'bg-line hover:bg-ink-muted'}`} />)}</div>
    </div>
  </div>
}
