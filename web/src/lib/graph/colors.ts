// Grad-year colors for the tree. Chosen to stay legible as 2px borders and hard
// shadows on white, and to sit next to the vermilion accent (designs/README.md).
const PALETTE = ['#c63d2f', '#d9971f', '#5e8a2e', '#1f8a70', '#4f55c9', '#9b4a9e', '#2a7fa8', '#c4527a']

export function yearColor(gradYear: number): string {
  const i = ((gradYear % PALETTE.length) + PALETTE.length) % PALETTE.length
  return PALETTE[i]
}
