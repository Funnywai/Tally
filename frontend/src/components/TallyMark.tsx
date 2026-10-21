interface TallyMarkProps {
  readonly size?: number;
  readonly className?: string;
  readonly label?: string;
}

export function TallyMark({ size = 24, className, label }: TallyMarkProps) {
  const barWidth = size * 0.075;
  const gap = size * 0.16;
  const startX = size / 2 - gap * 1.5;
  const top = size * 0.18;
  const bottom = size * 0.82;
  const bars = [0, 1, 2, 3].map((index) => (
    <rect
      key={index}
      x={startX + index * gap - barWidth / 2}
      y={top}
      width={barWidth}
      height={bottom - top}
      rx={barWidth / 2}
      fill="currentColor"
    />
  ));
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role={label === undefined ? undefined : 'img'}
      aria-label={label}
      aria-hidden={label === undefined ? true : undefined}
      focusable={false}
    >
      {bars}
      <rect
        x={startX - gap * 0.55}
        y={size / 2 - barWidth / 2}
        width={gap * 3 + gap * 1.1}
        height={barWidth}
        rx={barWidth / 2}
        fill="var(--cinnabar)"
        transform={`rotate(-24 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}
