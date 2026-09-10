'use client'
import { useEffect, useMemo } from 'react'
import { Background, Controls, Panel, ReactFlow, ReactFlowProvider, useReactFlow, type NodeMouseHandler, type NodeTypes } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { LinGraph as LinGraphData } from '@/lib/types'
import { layoutLin } from '@/lib/graph/layout'
import { buildFlowElements, buildYearNodes, type LinFlowNode } from '@/lib/graph/flow'
import { PersonNode } from '@/components/graph/PersonNode'
import { YearNode } from '@/components/graph/YearNode'

const nodeTypes = { person: PersonNode, year: YearNode } as unknown as NodeTypes

type Props = {
  graph: LinGraphData
  photoUrls: Map<string, string>
  selectedId: string | null
  onSelect: (personId: string | null) => void
  linKey: string
}

function Legend() {
  return (
    <Panel position="top-right" className="hidden sm:block">
      <dl className="rounded-md border bg-white/90 px-3 py-2 text-xs text-neutral-600 shadow-sm backdrop-blur">
        <div className="flex items-center gap-2">
          <svg width="26" height="10" aria-hidden className="shrink-0">
            <line x1="0" y1="5" x2="18" y2="5" stroke="#9ca3af" strokeWidth="1.5" />
            <path d="M18 1.5 L25 5 L18 8.5 Z" fill="#9ca3af" />
          </svg>
          <dt className="sr-only">Arrow</dt>
          <dd>points from big to little</dd>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <span aria-hidden className="h-4 w-4 shrink-0 rounded-full border-2 border-dashed border-neutral-400" />
          <dt className="sr-only">Dashed circle</dt>
          <dd>profile not claimed yet</dd>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <span aria-hidden className="w-[26px] shrink-0 text-center text-[10px] uppercase tracking-wide text-neutral-400">&#39;27</span>
          <dt className="sr-only">Rows</dt>
          <dd>each row is a graduating class</dd>
        </div>
      </dl>
    </Panel>
  )
}

function Canvas({ graph, photoUrls, selectedId, onSelect, linKey }: Props) {
  const layout = useMemo(() => layoutLin(graph), [graph])
  const { nodes: personNodes, edges } = useMemo(
    () => buildFlowElements(graph, layout, { selectedId, photoUrls }),
    [graph, layout, selectedId, photoUrls],
  )
  const nodes = useMemo<LinFlowNode[]>(
    () => [...buildYearNodes(graph, layout), ...personNodes],
    [graph, layout, personNodes],
  )
  const { fitView, setCenter, getNode } = useReactFlow()

  useEffect(() => { const t = setTimeout(() => fitView({ padding: 0.2 }), 0); return () => clearTimeout(t) }, [linKey, fitView])

  useEffect(() => {
    if (!selectedId) return
    const n = getNode(selectedId)
    if (n) setCenter(n.position.x + 90, n.position.y + 20, { zoom: 1.2, duration: 400 })
  }, [selectedId, getNode, setCenter])

  const onNodeClick: NodeMouseHandler<LinFlowNode> = (_e, node) => { if (node.type === 'person') onSelect(node.id) }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={onNodeClick}
      onPaneClick={() => onSelect(null)}
      nodesDraggable={false}
      nodesFocusable={false}
      edgesFocusable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      minZoom={0.2}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={24} />
      <Controls showInteractive={false} />
      <Legend />
    </ReactFlow>
  )
}

export function LinGraph(props: Props) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  )
}
