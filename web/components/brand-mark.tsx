// The InsiderClusters glyph: a "signal spike" — clustered data points on a
// rising line that break upward into a bright lead node, i.e. insider buys
// clustering into a bullish signal. Shared by the wordmark, favicon, app icons,
// and OG images so the brand is identical everywhere. `currentColor` inherits
// the on-accent token wherever it's placed.
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none">
      <path
        d="M4 16.5 L9 12.5 L12.5 14.5 L20.5 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.6"
      />
      <g fill="currentColor">
        <circle cx="4" cy="16.5" r="1.5" />
        <circle cx="9" cy="12.5" r="1.8" />
        <circle cx="12.5" cy="14.5" r="1.8" />
        <circle cx="20.5" cy="5" r="2.7" />
      </g>
    </svg>
  );
}
