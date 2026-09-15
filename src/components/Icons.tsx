import type { JSX } from 'preact';

type IconProps = { size?: number; class?: string } & JSX.SVGAttributes<SVGSVGElement>;

function base(size: number, rest: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 2,
    'stroke-linecap': 'round' as const,
    'stroke-linejoin': 'round' as const,
    'aria-hidden': true,
    ...rest,
  };
}

export const IconKids = ({ size = 24, ...r }: IconProps) => (
  <svg {...base(size, r)}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M15.5 14.5a5 5 0 0 1 6 5" />
  </svg>
);

export const IconRecords = ({ size = 24, ...r }: IconProps) => (
  <svg {...base(size, r)}>
    <path d="M6 3h9l4 4v14H6z" />
    <path d="M14 3v5h5" />
    <path d="M9 13h6M9 17h6" />
  </svg>
);

export const IconStats = ({ size = 24, ...r }: IconProps) => (
  <svg {...base(size, r)}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>
);

export const IconSettings = ({ size = 24, ...r }: IconProps) => (
  <svg {...base(size, r)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);

export const IconPlus = ({ size = 24, ...r }: IconProps) => (
  <svg {...base(size, r)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconSearch = ({ size = 24, ...r }: IconProps) => (
  <svg {...base(size, r)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const IconBack = ({ size = 24, ...r }: IconProps) => (
  <svg {...base(size, r)}>
    <path d="m15 5-7 7 7 7" />
  </svg>
);

export const IconChevron = ({ size = 20, ...r }: IconProps) => (
  <svg {...base(size, r)}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export const IconEdit = ({ size = 24, ...r }: IconProps) => (
  <svg {...base(size, r)}>
    <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z" />
    <path d="m13.5 6.5 3 3" />
  </svg>
);

export const IconX = ({ size = 16, ...r }: IconProps) => (
  <svg {...base(size, r)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const IconCheck = ({ size = 20, ...r }: IconProps) => (
  <svg {...base(size, r)}>
    <path d="m5 12 5 5 9-10" />
  </svg>
);

export const IconSort = ({ size = 24, ...r }: IconProps) => (
  <svg {...base(size, r)}>
    <path d="M4 7h16M7 12h10M10 17h4" />
  </svg>
);

export const IconFilter = ({ size = 24, ...r }: IconProps) => (
  <svg {...base(size, r)}>
    <path d="M3 5h18l-7 8v6l-4 2v-8z" />
  </svg>
);

export const IconAddPerson = ({ size = 24, ...r }: IconProps) => (
  <svg {...base(size, r)}>
    <circle cx="10" cy="8" r="3.5" />
    <path d="M3.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M19 8v6M16 11h6" />
  </svg>
);

export const IconShuffle = ({ size = 20, ...r }: IconProps) => (
  <svg {...base(size, r)}>
    <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
  </svg>
);

export const IconUndo = ({ size = 20, ...r }: IconProps) => (
  <svg {...base(size, r)}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
  </svg>
);

export const IconTrash = ({ size = 20, ...r }: IconProps) => (
  <svg {...base(size, r)}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
);

export const IconShare = ({ size = 20, ...r }: IconProps) => (
  <svg {...base(size, r)}>
    <path d="M12 3v13M7 8l5-5 5 5" />
    <path d="M5 13v7h14v-7" />
  </svg>
);

export const IconDownload = ({ size = 20, ...r }: IconProps) => (
  <svg {...base(size, r)}>
    <path d="M12 3v13M7 11l5 5 5-5" />
    <path d="M5 20h14" />
  </svg>
);

export const IconCalendar = ({ size = 20, ...r }: IconProps) => (
  <svg {...base(size, r)}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);
