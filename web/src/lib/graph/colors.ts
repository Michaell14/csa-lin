const PALETTE = ['#6366f1', '#14b8a6', '#f59e0b', '#ec4899', '#3b82f6', '#84cc16', '#f97316', '#8b5cf6']

export function yearColor(gradYear: number): string {
  const i = ((gradYear % PALETTE.length) + PALETTE.length) % PALETTE.length
  return PALETTE[i]
}
