'use client'
import { useState } from 'react'

// One destructive-action pattern for the whole app: the question appears where
// the button was, instead of in a browser dialog that leaves the page behind.
export function ConfirmButton({ label, ariaLabel, question, confirmLabel = 'Yes', cancelLabel = 'Cancel', onConfirm, className }: {
  label: string
  ariaLabel?: string
  question: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  className?: string
}) {
  const [asking, setAsking] = useState(false)
  if (!asking) {
    return <button onClick={() => setAsking(true)} aria-label={ariaLabel} className={className}>{label}</button>
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1 rounded border border-danger px-2 py-0.5 text-xs">
      <span>{question}</span>
      <button onClick={() => { setAsking(false); onConfirm() }} className="rounded px-1 font-medium text-danger underline">{confirmLabel}</button>
      <button onClick={() => setAsking(false)} className="rounded px-1 underline">{cancelLabel}</button>
    </span>
  )
}
