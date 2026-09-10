'use client'
import type { YearNodeData } from '@/lib/graph/flow'
import { YEAR_LABEL_W } from '@/lib/graph/flow'
import { NODE_H } from '@/lib/graph/layout'

export function YearNode({ data }: { data: YearNodeData }) {
  return (
    <div style={{ width: data.width, height: NODE_H }} className="flex select-none items-center gap-4">
      <span
        style={{ width: YEAR_LABEL_W }}
        className="shrink-0 whitespace-nowrap text-right text-xs font-medium uppercase tracking-wide text-neutral-400"
      >
        Class of {data.year}
      </span>
      <span aria-hidden className="h-px flex-1 bg-neutral-200" />
    </div>
  )
}
