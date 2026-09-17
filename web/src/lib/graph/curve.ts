// Vertical tangents soften the links without changing the left-to-right order
// of their endpoints. Ordered ports in the same generation gap stay ordered
// throughout the curve, so sibling connections do not cross or stack.
export function connectionCurve(sourceX: number, sourceY: number, targetX: number, targetY: number) {
  const bend = Math.min(48, Math.max(0, targetY - sourceY) * 0.35)
  const control1 = { x: sourceX, y: sourceY + bend }
  const control2 = { x: targetX, y: targetY - bend }
  return {
    control1,
    control2,
    path: `M ${sourceX},${sourceY} C ${control1.x},${control1.y} ${control2.x},${control2.y} ${targetX},${targetY}`,
  }
}
