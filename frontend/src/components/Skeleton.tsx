const SKELETON_KEYS = ['s1', 's2', 's3', 's4', 's5'] as const;

export function Skeleton({ lines = 3 }: { readonly lines?: number }) {
  return (
    <div className="skeleton-stack" aria-hidden="true">
      {SKELETON_KEYS.slice(0, lines).map((key) => (
        <div key={key} className="skeleton" />
      ))}
    </div>
  );
}
