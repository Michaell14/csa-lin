import type { ReactNode } from 'react'
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LinGraph as LinGraphData } from '@/lib/types'
import { linAGraph, ID } from '@/lib/testFixtures'

// The canvas pulls in React Flow's stylesheet, which these tests never render.
vi.mock('@xyflow/react/dist/style.css', () => ({}))
const flow = vi.hoisted(() => ({ setCenter: vi.fn(), fitView: vi.fn() }))
vi.mock('@xyflow/react', () => ({
  Background: () => null,
  Controls: () => null,
  Handle: () => null,
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
  ReactFlow: () => null,
  ReactFlowProvider: ({ children }: { children: ReactNode }) => children,
  useReactFlow: () => flow,
}))

import { LinGraph } from '@/components/graph/LinGraph'

const EMPTY: LinGraphData = { people: [], links: [] }
const props = { photoUrls: new Map<string, string>(), onSelect: vi.fn() }

describe('LinGraph focus', () => {
  beforeEach(() => { flow.setCenter.mockClear(); flow.fitView.mockClear() })

  it('centers on the selected person once the graph has loaded', () => {
    const view = render(<LinGraph {...props} graph={EMPTY} selectedId={ID.child1} linKey="lin-a" focusToken={1} />)
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

    // The previous lin's nodes stay mounted until the new graph arrives.
    view.rerender(<LinGraph {...props} graph={linAGraph} selectedId={ID.child1} linKey="lin-b" focusToken={1} />)
    const otherLin: LinGraphData = { people: linAGraph.people.slice(2), links: [] }
    view.rerender(<LinGraph {...props} graph={otherLin} selectedId={ID.child1} linKey="lin-b" focusToken={1} />)

    const moves = flow.setCenter.mock.calls
    expect(moves.length).toBeGreaterThan(1)
    expect(moves.at(-1)).not.toEqual(moves[0])
  })

  it('ignores a selection that is not in the graph', () => {
    render(<LinGraph {...props} graph={linAGraph} selectedId="missing" linKey="lin-a" focusToken={1} />)
    expect(flow.setCenter).not.toHaveBeenCalled()
  })
})
