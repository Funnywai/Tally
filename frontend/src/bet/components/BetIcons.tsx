// biome-ignore-all lint/a11y/noSvgWithoutTitle: decorative icons are labelled by their parent controls
export interface BetIconProps {
  readonly size?: number;
  readonly className?: string;
}

function base(size: number, className?: string) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
    className,
  };
}

export function BetPitchMarkIcon({ size = 22, className }: BetIconProps) {
  return (
    <svg {...base(size, className)}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M12 4v16M3 12h18" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

export function BetGridIcon({ size = 16, className }: BetIconProps) {
  return (
    <svg {...base(size, className)}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function BetSlipIcon({ size = 22, className }: BetIconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z" />
      <path d="M8 7h8M8 11h6M8 15h4" />
    </svg>
  );
}

export function BetChartIcon({ size = 22, className }: BetIconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}

export function BetPlusIcon({ size = 16, className }: BetIconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function BetXIcon({ size = 20, className }: BetIconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function BetTrashIcon({ size = 16, className }: BetIconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" />
    </svg>
  );
}

export function BetRefreshIcon({ size = 14, className }: BetIconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
    </svg>
  );
}

export function BetCheckIcon({ size = 18, className }: BetIconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 12.5l5 5L20 6" />
    </svg>
  );
}

export function BetAlertIcon({ size = 18, className }: BetIconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 3l9 17H3z" />
      <path d="M12 9v5M12 17h.01" />
    </svg>
  );
}

export function BetInfoIcon({ size = 18, className }: BetIconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  );
}

export function BetLoaderIcon({ size = 16, className }: BetIconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}
