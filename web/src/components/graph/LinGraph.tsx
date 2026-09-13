'use client'
import { useEffect, useMemo, useRef } from 'react'
import { Background, Controls, ReactFlow, ReactFlowProvider, useReactFlow, type NodeMouseHandler } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { LinGraph as LinGraphData } from '@/lib/types'
import { layoutLin } from '@/lib/graph/layout'
import { buildFlowElements, type PersonFlowNode } from '@/lib/graph/flow'
import { PersonNode } from '@/components/graph/PersonNode'

const nodeTypes = { person: PersonNode }

type Props = {
  graph: LinGraphData
  photoUrls: Map<string, string>
  selectedId: string | null
  onSelect: (personId: string) => void
  linKey: string
  focusToken?: number
}

function Canvas({ graph, photoUrls, selectedId, onSelect, linKey, focusToken }: Props) {
  const layout = useMemo(() => layoutLin(graph), [graph])
  const { nodes, edges } = useMemo(() => buildFlowElements(graph, layout, { selectedId, photoUrls }), [graph, layout, selectedId, photoUrls])
  const { fitView, setCenter } = useReactFlow()
  const centeredFor = useRef<string | null>(null)

  useEffect(() => { const t = setTimeout(() => fitView({ padding: 0.2 }), 0); return () => clearTimeout(t) }, [linKey, fitView])

  // `nodes` is a dependency because the graph loads asynchronously: a focus
  // request can land before the selected person's node exists, and the centering
  // has to happen once it arrives. `centeredFor` keeps that to one move per
  // request, so unrelated node rebuilds don't yank the viewport back.
  useEffect(() => {
    if (!selectedId) { centeredFor.current = null; return }
    const request = `${selectedId}:${focusToken ?? 0}`
    if (centeredFor.current === request) return
    const n = nodes.find(node => node.id === selectedId)
    if (!n) return
    centeredFor.current = request
    setCenter(n.position.x + 90, n.position.y + 20, { zoom: 1.2, duration: 400 })
  }, [selectedId, focusToken, nodes, setCenter])

  const onNodeClick: NodeMouseHandler<PersonFlowNode> = (_e, node) => onSelect(node.id)

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={onNodeClick}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      minZoom={0.2}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={24} />
      <Controls showInteractive={false} />
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
