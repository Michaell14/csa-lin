'use client'

// What a member who belongs to no lin sees over the graph: the page has opened
// someone else's lin for them, and without this they have no way to tell the
// tree on screen is not theirs, or what would make one appear.
export function NoLinNotice({ onOpenProfile }: { onOpenProfile: () => void }) {
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface-muted px-3 py-2 text-sm text-ink-body sm:px-4">
      <p className="min-w-0 flex-1">You&#39;re not in a lin yet. A lin starts on its own once you and your big or little confirm your link from your profile.</p>
      <button onClick={onOpenProfile} className="btn-sm">Open my profile</button>
    </div>
  )
}
