// Grad-year colors for the tree. Chosen to stay legible as 2px borders on
// white and to be told apart from one another (designs/README.md).
// Also the colours a newly founded lin is dealt, so `lin_palette()` in
// supabase/migrations/20260915000001_member_lins.sql mirrors this list; a
// test keeps the two in step.
export const PALETTE = ['#c63d2f', '#d9971f', '#5e8a2e', '#1f8a70', '#4f55c9', '#9b4a9e', '#2a7fa8', '#c4527a']

export function yearColor(gradYear: number): string {
  const i = ((gradYear % PALETTE.length) + PALETTE.length) % PALETTE.length
  return PALETTE[i]
}
