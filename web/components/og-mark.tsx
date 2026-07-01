// The brand glyph for next/og (satori) contexts, where Tailwind classes and
// currentColor aren't available — so colors/sizes are explicit. Mirrors
// <BrandMark> exactly (the "signal spike") to keep the logo identical on social
// cards and app icons.
export function OgMark({ size = 44, color = "#ffffff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M4 16.5 L9 12.5 L12.5 14.5 L20.5 5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.6}
      />
      <g fill={color}>
        <circle cx="4" cy="16.5" r="1.5" />
        <circle cx="9" cy="12.5" r="1.8" />
        <circle cx="12.5" cy="14.5" r="1.8" />
        <circle cx="20.5" cy="5" r="2.7" />
      </g>
    </svg>
  );
}
