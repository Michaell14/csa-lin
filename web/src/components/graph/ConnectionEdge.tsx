import { BaseEdge, type EdgeProps } from '@xyflow/react'
import { connectionCurve } from '@/lib/graph/curve'

export function ConnectionEdge({ sourceX, sourceY, targetX, targetY, style, markerEnd, interactionWidth }: EdgeProps) {
  const { path } = connectionCurve(sourceX, sourceY, targetX, targetY)
  return <BaseEdge path={path} style={style} markerEnd={markerEnd} interactionWidth={interactionWidth} />
}
