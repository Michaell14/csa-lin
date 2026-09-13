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
  // The lin the graph belongs to, not the one selected: they differ while a new
  // lin loads, and viewport decisions must not be made from the outgoing nodes.
  linKey: string | null
  focusToken?: number
}

function Canvas({ graph, photoUrls, selectedId, onSelect, linKey, focusToken }: Props) {
  const layout = useMemo(() => layoutLin(graph), [graph])
  const { nodes, edges } = useMemo(() => buildFlowElements(graph, layout, { selectedId, photoUrls }), [graph, layout, selectedId, photoUrls])
  const { fitView, setCenter } = useReactFlow()
  const centeredFor = useRef<string | null>(null)
  const fittedFor = useRef<string | null>(null)

  // What the lin currently occupies. Keying the fit on this rather than on the
  // lin alone means a reload that adds or removes people is framed again, while
  // one that redraws the same shape leaves a panned viewport where it is.
  const extent = useMemo(() => {
    if (nodes.length === 0) return null
    const xs = nodes.map(n => n.position.x), ys = nodes.map(n => n.position.y)
    return `${Math.min(...xs)},${Math.min(...ys)},${Math.max(...xs)},${Math.max(...ys)}`
  }, [nodes])

  // One viewport decision per lin and extent. If the selected person is in it,
  // the centering effect below takes the viewport and this leaves it alone; that
  // way a deferred fit cannot land on top of the centering. The fit stays
  // deferred a tick so React Flow has measured the nodes before framing them.
  useEffect(() => {
    if (!linKey || !extent) return
    const decision = `${linKey}:${extent}`
    if (fittedFor.current === decision) return
    fittedFor.current = decision
    if (selectedId && nodes.some(node => node.id === selectedId)) return
    const t = setTimeout(() => fitView({ padding: 0.2 }), 0)
    return () => clearTimeout(t)
  }, [linKey, extent, nodes, selectedId, fitView])

  // `nodes` is a dependency because the graph loads asynchronously: a focus
  // request can land before the selected person's node exists, and the centering
  // has to happen once it arrives. The remembered request carries the lin and the
  // node's position, so the viewport also follows a person who stays selected
  // while a new lin redraws them somewhere else. Unrelated node rebuilds leave
  // the same request, and the viewport stays where the user left it.
  useEffect(() => {
    if (!selectedId) { centeredFor.current = null; return }
    // No lin owns these nodes mid-reload; leave the viewport where the user has it.
    if (!linKey) return
    const n = nodes.find(node => node.id === selectedId)
    if (!n) return
    const request = `${linKey}:${selectedId}:${focusToken ?? 0}:${n.position.x},${n.position.y}`
    if (centeredFor.current === request) return
    centeredFor.current = request
    setCenter(n.position.x + 90, n.position.y + 20, { zoom: 1.2, duration: 400 })
  }, [selectedId, focusToken, linKey, nodes, setCenter])

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
