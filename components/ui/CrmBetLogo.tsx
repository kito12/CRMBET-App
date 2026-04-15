/**
 * DeskHive brand mark — geometric DH monogram.
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
      aria-label="DeskHive logo"
    >
      {/* ── D ── */}
      {/* Vertical stroke */}
      <rect x="1.5" y="3" width="2.5" height="18" rx="1.2" fill="currentColor" />
      {/* Curved bowl — full height D shape */}
      <path
        d="M 4 3 L 7 3 C 12.5 3, 12.5 21, 7 21 L 4 21 Z"
        fill="currentColor"
      />

      {/* ── H ── */}
      {/* Left vertical */}
      <rect x="13.5" y="3" width="2.5" height="18" rx="1.2" fill="currentColor" />
      {/* Right vertical */}
      <rect x="20.5" y="3" width="2"   height="18" rx="1"   fill="currentColor" />
      {/* Cross bar */}
      <rect x="13.5" y="9.5" width="9" height="2.5" rx="1.2" fill="currentColor" />
    </svg>
  );
}
