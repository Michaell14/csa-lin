'use client'
import { useCallback, useEffect, useMemo, useRef, type KeyboardEvent } from 'react'
import { Background, Controls, ReactFlow, ReactFlowProvider, useReactFlow, useStore, type NodeMouseHandler } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { LinGraph as LinGraphData } from '@/lib/types'
import { layoutLin } from '@/lib/graph/layout'
import { buildFlowEdges, buildFlowNodes, withSelection, type PersonFlowNode } from '@/lib/graph/flow'
import { PersonNode } from '@/components/graph/PersonNode'
import { ConnectionEdge } from '@/components/graph/ConnectionEdge'

const nodeTypes = { person: PersonNode }
const edgeTypes = { connection: ConnectionEdge }
const initialFitOptions = { padding: 0.2 }
// React Flow describes every focused node with its own selection and drag
// instructions, which do not apply here: nothing is selectable or draggable.
const ariaLabelConfig = {
  'node.a11yDescription.default': 'Press Enter or Space to open this person.',
  'node.a11yDescription.keyboardDisabled': 'Press Enter or Space to open this person.',
}

type Props = {
  graph: LinGraphData
  photoUrls: Map<string, string>
  selectedId: string | null
  onSelect: (personId: string) => void
  // The lin the graph belongs to, not the one selected: they differ while a new
  // lin loads, and viewport decisions must not be made from the outgoing nodes.
  linKey: string | null
  focusToken?: number
  highlightedLinkIds?: Set<string>
}

function Canvas({ graph, photoUrls, selectedId, onSelect, linKey, focusToken, highlightedLinkIds }: Props) {
  const layout = useMemo(() => layoutLin(graph), [graph])
  // Selection is layered on top of the built nodes rather than built in, so a
  // click replaces two node objects and React Flow leaves the rest mounted as
  // they are; the edges change with the highlighted path, not the selection.
  const baseNodes = useMemo(() => buildFlowNodes(graph, layout, { selectedId: null, photoUrls }), [graph, layout, photoUrls])
  const nodes = useMemo(() => baseNodes.map(node => withSelection(node, node.id === selectedId)), [baseNodes, selectedId])
  const edges = useMemo(() => buildFlowEdges(graph, { highlightedLinkIds }), [graph, highlightedLinkIds])
  const { fitView, setCenter } = useReactFlow()
  // A graph tab can mount while the profile panel already takes part of the
  // row. Centering before React Flow measures that narrower canvas uses zero
  // (or stale) dimensions and leaves the graph at the top left.
  const paneReady = useStore(s => s.width > 0 && s.height > 0 && Boolean(s.panZoom))
  const centeredFor = useRef<string | null>(null)
  const fittedFor = useRef<string | null>(null)
  const selectedIsDrawn = Boolean(selectedId && nodes.some(node => node.id === selectedId))

  // What the lin currently occupies. Keying the fit on this rather than on the
  // lin alone means a reload that adds or removes people is framed again, while
  // one that redraws the same shape leaves a panned viewport where it is.
  const extent = useMemo(() => {
    if (nodes.length === 0) return null
    const xs = nodes.map(n => n.position.x), ys = nodes.map(n => n.position.y)
    return `${Math.min(...xs)},${Math.min(...ys)},${Math.max(...xs)},${Math.max(...ys)}`
  }, [nodes])

  // One viewport decision per lin, extent, and whether the selected person is
  // actually drawn. When they are, the centering effect below takes the viewport
  // and this leaves it alone, so a deferred fit cannot land on top of the
  // centering; when a reload drops them, the lin is framed again rather than
  // leaving the user looking at where they used to be. Clearing the selection is
  // not a reload and deliberately does not reframe anything. The fit stays
  // deferred a tick for graph data that arrives after mount. React Flow's own
  // initial fit handles a graph that is already loaded when this tab mounts.
  useEffect(() => {
    if (!linKey || !extent || !paneReady) return
    const missing = Boolean(selectedId) && !nodes.some(node => node.id === selectedId)
    const decision = `${linKey}:${extent}:${missing}`
    if (fittedFor.current === decision) return
    if (selectedId && !missing) { fittedFor.current = decision; return }
    const t = setTimeout(() => {
      fittedFor.current = decision
      void fitView({ padding: 0.2 })
    }, 0)
    return () => clearTimeout(t)
  }, [linKey, extent, nodes, selectedId, fitView, paneReady])

  // `nodes` is a dependency because the graph loads asynchronously: a focus
  // request can land before the selected person's node exists, and the centering
  // has to happen once it arrives. The remembered request carries the lin and the
  // node's position, so the viewport also follows a person who stays selected
  // while a new lin redraws them somewhere else. Unrelated node rebuilds leave
  // the same request, and the viewport stays where the user left it.
  useEffect(() => {
    if (!selectedId) { centeredFor.current = null; return }
    // No lin owns these nodes mid-reload; leave the viewport where the user has it.
    if (!linKey || !paneReady) return
    const n = nodes.find(node => node.id === selectedId)
    if (!n) return
    const request = `${linKey}:${selectedId}:${focusToken ?? 0}:${n.position.x},${n.position.y}`
    if (centeredFor.current === request) return
    centeredFor.current = request
    setCenter(n.position.x + 90, n.position.y + 20, { zoom: 1.2, duration: 400 })
  }, [selectedId, focusToken, linKey, nodes, setCenter, paneReady])

  const onNodeClick: NodeMouseHandler<PersonFlowNode> = (_e, node) => {
    if (!node.data.person.placeholder) onSelect(node.id)
  }
  // Nodes take focus (Tab moves between them and the viewport follows), but
  // React Flow only acts on Enter and Space when elements are selectable, and
  // here they are not. The key press bubbles to the canvas, which opens the
  // focused person the way a click would.
  const onKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    const id = (event.target as HTMLElement).closest<HTMLElement>('.react-flow__node')?.dataset.id
    if (!id) return
    const person = graph.people.find(p => p.id === id)
    if (!person || person.placeholder) return
    event.preventDefault()
    onSelect(id)
  }, [graph.people, onSelect])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView={!selectedIsDrawn}
      fitViewOptions={initialFitOptions}
      onNodeClick={onNodeClick}
      onKeyDown={onKeyDown}
      ariaLabelConfig={ariaLabelConfig}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      minZoom={0.2}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={24} size={1} color="#ddd5ca" />
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
