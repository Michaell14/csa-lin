'use client'
export function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-40 flex justify-center px-3">
      <div
        role="alert"
        className="pointer-events-auto flex max-w-xl items-start gap-3 rounded-md border bg-danger-surface px-3 py-2 text-sm text-danger shadow-lg"
      >
        <span>{message}</span>
        <button onClick={onDismiss} aria-label="Dismiss error" className="-my-1 shrink-0 rounded px-2 py-1 underline hover:bg-surface-hover">
          Dismiss
        </button>
      </div>
    </div>
  )
}
