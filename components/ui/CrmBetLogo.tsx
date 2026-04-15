/**
 * CrmBet brand mark — three parallel diagonal bars of varying lengths
 * suggesting speed and data flow. Uses `currentColor` so it inherits
 * the parent's text color (white on dark backgrounds, purple standalone).
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
      aria-label="CrmBet logo"
    >
      {/* Three truly-parallel diagonal bars — rotated as a group so spacing is exact */}
      <g transform="rotate(-28 12 12)">
        {/* Top bar — shortest */}
        <rect x="9.5" y="3.5"  width="8"  height="2.8" rx="1.4" fill="currentColor" />
        {/* Middle bar — longest */}
        <rect x="2.5" y="10.5" width="19" height="2.8" rx="1.4" fill="currentColor" />
        {/* Bottom bar — medium */}
        <rect x="5.5" y="17.5" width="13" height="2.8" rx="1.4" fill="currentColor" />
      </g>
    </svg>
  );
}
