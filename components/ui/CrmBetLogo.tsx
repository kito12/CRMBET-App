/**
 * PremierBet brand mark — geometric PB monogram.
 * Uses `currentColor` so it renders white on dark/gradient backgrounds
 * and inherits any colour in standalone contexts.
 */
export default function CrmBetLogo({
  size = 20,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="PremierBet logo"
    >
      {/* ── P ── */}
      {/* Vertical stroke */}
      <rect x="1.5" y="3" width="2.5" height="18" rx="1.2" fill="currentColor" />
      {/* Bowl — top half only */}
      <path
        d="M 4 3 L 8.5 3 C 11.8 3, 11.8 9.5, 8.5 9.5 L 4 9.5 Z"
        fill="currentColor"
      />

      {/* ── B ── */}
      {/* Vertical stroke */}
      <rect x="13" y="3" width="2.5" height="18" rx="1.2" fill="currentColor" />
      {/* Upper bump */}
      <path
        d="M 15.5 3 L 18.5 3 C 22 3, 22 8.5, 18.5 8.5 L 15.5 8.5 Z"
        fill="currentColor"
      />
      {/* Lower bump — slightly wider for classic B proportion */}
      <path
        d="M 15.5 9.5 L 19 9.5 C 23 9.5, 23 15.5, 19 15.5 L 15.5 15.5 Z"
        fill="currentColor"
      />
    </svg>
  );
}
