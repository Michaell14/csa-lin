import { describe, expect, it } from 'vitest'
import { connectionCurve } from '@/lib/graph/curve'

const xAt = (from: number, to: number, t: number) =>
  from * (1 - t) ** 3 + 3 * from * (1 - t) ** 2 * t + 3 * to * (1 - t) * t ** 2 + to * t ** 3

describe('connectionCurve', () => {
  it('gently bends diagonal links with vertical tangents', () => {
    const curve = connectionCurve(20, 40, 120, 120)
    expect(curve.control1).toEqual({ x: 20, y: 68 })
    expect(curve.control2).toEqual({ x: 120, y: 92 })
    expect(curve.path).toContain(' C ')
  })

  it('keeps links with ordered ports apart throughout the same generation gap', () => {
    const left = connectionCurve(40, 40, 20, 120)
    const right = connectionCurve(60, 40, 120, 120)
    for (let step = 0; step <= 100; step++) {
      const t = step / 100
      expect(xAt(40, 20, t)).toBeLessThan(xAt(60, 120, t))
    }
    expect(left.control1.y).toBe(right.control1.y)
    expect(left.control2.y).toBe(right.control2.y)
  })
})
