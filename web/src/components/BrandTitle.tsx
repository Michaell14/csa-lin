export function BrandTitle({ className = '' }: { className?: string }) {
  return (
    <span className={`heading shrink-0 items-center gap-1.5 text-lg ${className}`}>
      {/* The supplied PNG has wide transparent margins; zoom it within a small
          fixed box so the visible mark stays close to the title's text height. */}
      <span
        aria-hidden="true"
        className="h-9 w-12 shrink-0 bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/csa-logo.png')", backgroundSize: '76px 76px' }}
      />
      CSA Lins
    </span>
  )
}
