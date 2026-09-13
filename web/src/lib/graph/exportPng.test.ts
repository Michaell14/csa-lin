import { describe, expect, it } from 'vitest'
import { exportDimensions } from '@/lib/graph/exportPng'
import { linAGraph } from '@/lib/testFixtures'

describe('exportDimensions', () => {
  it('creates a canvas large enough for the laid out lin', () => {
    const result = exportDimensions(linAGraph)
    expect(result.width).toBeGreaterThanOrEqual(900)
    expect(result.height).toBeGreaterThanOrEqual(500)
    expect(result.layout.nodes).toHaveLength(linAGraph.people.length)
  })
})
