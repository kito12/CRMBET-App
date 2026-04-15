// Reusable skeleton loader components

export function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`skeleton h-3 rounded-lg ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>
      <div className="skeleton h-8 w-8 rounded-lg mb-3" />
      <div className="skeleton h-2.5 w-20 mb-2" />
      <div className="skeleton h-7 w-14 mb-2" />
      <div className="skeleton h-2.5 w-24" />
    </div>
  );
}

export function SkeletonTableRow({ cols = 5 }: { cols?: number }) {
  const widths = ["w-20", "w-28", "w-32", "w-16", "w-20", "w-14", "w-18", "w-16", "w-24"];
  return (
    <div className="flex items-center gap-4 px-3 py-3.5 rounded-xl" style={{ background: "var(--surface-low)" }}>
      {Array.from({ length: cols }, (_, i) => (
        <div key={i} className={`skeleton h-3 flex-1 ${widths[i % widths.length]}`} />
      ))}
    </div>
  );
}

export function SkeletonStatRow() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
    </div>
  );
}
