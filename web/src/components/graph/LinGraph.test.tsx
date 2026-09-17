import type { ReactNode } from 'react'
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LinGraph as LinGraphData } from '@/lib/types'
import { linAGraph, ID } from '@/lib/testFixtures'

// The canvas pulls in React Flow's stylesheet, which these tests never render.
vi.mock('@xyflow/react/dist/style.css', () => ({}))
const flow = vi.hoisted(() => ({
  setCenter: vi.fn(),
  fitView: vi.fn(),
  initialFit: false,
  nodes: [] as Array<{ id: string; position: { x: number; y: number } }>,
  getNode: vi.fn((id: string) => flow.nodes.find(node => node.id === id)),
}))
vi.mock('@xyflow/react', () => ({
  Background: () => null,
  Controls: () => null,
  Handle: () => null,
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
  ReactFlow: ({ nodes, fitView }: { nodes: typeof flow.nodes; fitView?: boolean }) => {
    flow.nodes = nodes
    flow.initialFit = fitView ?? false
    return null
  },
  ReactFlowProvider: ({ children }: { children: ReactNode }) => children,
  useReactFlow: () => flow,
  useStore: (selector: (state: { width: number; height: number; panZoom: object }) => boolean) => selector({ width: 800, height: 600, panZoom: {} }),
}))

import { LinGraph } from '@/components/graph/LinGraph'

const EMPTY: LinGraphData = { people: [], links: [] }
const props = { photoUrls: new Map<string, string>(), onSelect: vi.fn() }

describe('LinGraph focus', () => {
  beforeEach(() => { flow.setCenter.mockClear(); flow.fitView.mockClear(); flow.initialFit = false })

  it('asks React Flow to fit an already loaded graph on entry', () => {
    render(<LinGraph {...props} graph={linAGraph} selectedId={null} linKey="lin-a" />)
    expect(flow.initialFit).toBe(true)
  })

  // `linKey` is the lin the graph belongs to, so it arrives with the nodes.
  it('centers on the selected person once the graph has loaded', () => {
    const view = render(<LinGraph {...props} graph={EMPTY} selectedId={ID.child1} linKey={null} focusToken={1} />)
    expect(flow.setCenter).not.toHaveBeenCalled()

    view.rerender(<LinGraph {...props} graph={linAGraph} selectedId={ID.child1} linKey="lin-a" focusToken={1} />)
    expect(flow.setCenter).toHaveBeenCalledOnce()
  })

  it('does not re-center when unrelated node data changes', () => {
    const view = render(<LinGraph {...props} graph={linAGraph} selectedId={ID.child1} linKey="lin-a" focusToken={1} />)
    expect(flow.setCenter).toHaveBeenCalledOnce()

    view.rerender(<LinGraph {...props} photoUrls={new Map([['x', 'https://x/1']])} onSelect={props.onSelect}
      graph={linAGraph} selectedId={ID.child1} linKey="lin-a" focusToken={1} />)
    expect(flow.setCenter).toHaveBeenCalledOnce()
  })

  it('re-centers when a repeated focus request comes in', () => {
    const view = render(<LinGraph {...props} graph={linAGraph} selectedId={ID.child1} linKey="lin-a" focusToken={1} />)
    view.rerender(<LinGraph {...props} graph={linAGraph} selectedId={ID.child1} linKey="lin-a" focusToken={2} />)
    expect(flow.setCenter).toHaveBeenCalledTimes(2)
  })

  it('re-centers a person who stays selected while a new lin redraws them', () => {
    const view = render(<LinGraph {...props} graph={linAGraph} selectedId={ID.child1} linKey="lin-a" focusToken={1} />)
    expect(flow.setCenter).toHaveBeenCalledOnce()

    const otherLin: LinGraphData = { people: linAGraph.people.slice(2), links: [] }
    view.rerender(<LinGraph {...props} graph={otherLin} selectedId={ID.child1} linKey="lin-b" focusToken={1} />)

    const moves = flow.setCenter.mock.calls
    expect(moves).toHaveLength(2)
    expect(moves[1]).not.toEqual(moves[0])
  })

  it('leaves the viewport alone while the same lin reloads', () => {
    const view = render(<LinGraph {...props} graph={linAGraph} selectedId={ID.child1} linKey="lin-a" focusToken={1} />)
    expect(flow.setCenter).toHaveBeenCalledOnce()

    // A reload stops vouching for the people on screen, then puts the same lin
    // back. A user who has panned away should not be dragged back by that.
    view.rerender(<LinGraph {...props} graph={linAGraph} selectedId={ID.child1} linKey={null} focusToken={1} />)
    view.rerender(<LinGraph {...props} graph={linAGraph} selectedId={ID.child1} linKey="lin-a" focusToken={1} />)
    expect(flow.setCenter).toHaveBeenCalledOnce()
  })

  it('frames the lin again when a reload changes what it occupies', async () => {
    const view = render(<LinGraph {...props} graph={linAGraph} selectedId={null} linKey="lin-a" focusToken={0} />)
    await new Promise(r => setTimeout(r, 5))
    expect(flow.fitView).toHaveBeenCalledOnce()

    const smaller: LinGraphData = { people: linAGraph.people.slice(0, 2), links: [] }
    view.rerender(<LinGraph {...props} graph={smaller} selectedId={null} linKey="lin-a" focusToken={0} />)
    await new Promise(r => setTimeout(r, 5))
    expect(flow.fitView).toHaveBeenCalledTimes(2)
  })

  it('does not fit when a lin that opened on a profile has that profile closed', async () => {
    // The reverse order of the test above: the lin arrives already selected, so
    // it was never fitted, and closing the panel must still not move the user.
    const view = render(<LinGraph {...props} graph={linAGraph} selectedId={ID.child1} linKey="lin-a" focusToken={1} />)
    await new Promise(r => setTimeout(r, 5))
    expect(flow.fitView).not.toHaveBeenCalled()

    view.rerender(<LinGraph {...props} graph={linAGraph} selectedId={null} linKey="lin-a" focusToken={1} />)
    await new Promise(r => setTimeout(r, 5))
    expect(flow.fitView).not.toHaveBeenCalled()
  })

  it('frames the lin again when a reload drops the person it was centered on', async () => {
    const view = render(<LinGraph {...props} graph={linAGraph} selectedId={ID.child1} linKey="lin-a" focusToken={1} />)
    expect(flow.setCenter).toHaveBeenCalledOnce()
    await new Promise(r => setTimeout(r, 5))
    expect(flow.fitView).not.toHaveBeenCalled()

    const without: LinGraphData = {
      people: linAGraph.people.filter(p => p.id !== ID.child1),
      links: linAGraph.links.filter(l => l.big_id !== ID.child1 && l.little_id !== ID.child1),
    }
    view.rerender(<LinGraph {...props} graph={without} selectedId={ID.child1} linKey="lin-a" focusToken={1} />)
    await new Promise(r => setTimeout(r, 5))
    expect(flow.fitView).toHaveBeenCalledOnce()
  })

  it('ignores a selection that is not in the graph', () => {
    render(<LinGraph {...props} graph={linAGraph} selectedId="missing" linKey="lin-a" focusToken={1} />)
    expect(flow.setCenter).not.toHaveBeenCalled()
  })

  it('leaves the viewport to the centering rather than fitting over it', async () => {
    render(<LinGraph {...props} graph={linAGraph} selectedId={ID.child1} linKey="lin-a" focusToken={1} />)
    expect(flow.initialFit).toBe(false)
    expect(flow.setCenter).toHaveBeenCalledOnce()
    await new Promise(r => setTimeout(r, 5))
    expect(flow.fitView).not.toHaveBeenCalled()
  })

  it('fits the lin when the selected person is not in it', async () => {
    render(<LinGraph {...props} graph={linAGraph} selectedId="missing" linKey="lin-a" focusToken={1} />)
    await new Promise(r => setTimeout(r, 5))
    expect(flow.fitView).toHaveBeenCalledOnce()
  })

  it('fits once per loaded lin, not when the selection is cleared', async () => {
    const view = render(<LinGraph {...props} graph={linAGraph} selectedId={null} linKey="lin-a" focusToken={0} />)
    await new Promise(r => setTimeout(r, 5))
    expect(flow.fitView).toHaveBeenCalledOnce()

    view.rerender(<LinGraph {...props} graph={linAGraph} selectedId={ID.child1} linKey="lin-a" focusToken={0} />)
    view.rerender(<LinGraph {...props} graph={linAGraph} selectedId={null} linKey="lin-a" focusToken={0} />)
    await new Promise(r => setTimeout(r, 5))
    expect(flow.fitView).toHaveBeenCalledOnce()
  })
})
