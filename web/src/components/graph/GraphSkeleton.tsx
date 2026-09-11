import { NODE_H, NODE_W } from '@/lib/graph/layout'

const ROWS = [1, 2, 3, 2]

// Stands in for the tree while it loads, so the canvas isn't a blank rectangle.
export function GraphSkeleton() {
  return (
    <div aria-hidden data-testid="graph-skeleton" className="flex h-full animate-pulse flex-col items-center justify-center gap-10 p-6">
      {ROWS.map((count, row) => (
        <div key={row} className="flex gap-8">
          {Array.from({ length: count }, (_, i) => (
            <div key={i} style={{ width: NODE_W, height: NODE_H }} className="max-w-[40vw] rounded-full bg-surface-hover" />
          ))}
        </div>
      ))}
    </div>
  )
}
