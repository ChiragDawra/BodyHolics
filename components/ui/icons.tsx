/**
 * Every icon in the app, hand-drawn as inline SVG.
 *
 * No icon library — these are the only glyphs we need and each one is a few
 * lines. They inherit `currentColor` so they take their colour from whatever
 * token the surrounding element sets, and never carry a colour of their own.
 */
type IconProps = {
  className?: string;
  strokeWidth?: number;
};

function base(className?: string) {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className,
  };
}

export function HomeIcon({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(className)} strokeWidth={strokeWidth}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
    </svg>
  );
}

export function ActivityIcon({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(className)} strokeWidth={strokeWidth}>
      <path d="M3 12h3.5l2.5 6 4-14 2.5 8H21" />
    </svg>
  );
}

export function UserIcon({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(className)} strokeWidth={strokeWidth}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}

export function BellIcon({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(className)} strokeWidth={strokeWidth}>
      <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9Z" />
      <path d="M10 18a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function LockIcon({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(className)} strokeWidth={strokeWidth}>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8.5 10.5V7a3.5 3.5 0 0 1 7 0v3.5" />
    </svg>
  );
}

export function LockOpenIcon({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(className)} strokeWidth={strokeWidth}>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8.5 10.5V7a3.5 3.5 0 0 1 6.9-1" />
    </svg>
  );
}

export function BackspaceIcon({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(className)} strokeWidth={strokeWidth}>
      <path d="M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9L3 12Z" />
      <path d="M17 9.5 12.5 14.5M12.5 9.5 17 14.5" />
    </svg>
  );
}

export function CheckIcon({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(className)} strokeWidth={strokeWidth}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  );
}

export function CloseIcon({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(className)} strokeWidth={strokeWidth}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function SearchIcon({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(className)} strokeWidth={strokeWidth}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}

export function ChevronRightIcon({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(className)} strokeWidth={strokeWidth}>
      <path d="m9.5 5 7 7-7 7" />
    </svg>
  );
}

export function ChevronLeftIcon({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(className)} strokeWidth={strokeWidth}>
      <path d="m14.5 5-7 7 7 7" />
    </svg>
  );
}

export function PlusIcon({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(className)} strokeWidth={strokeWidth}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function UsersIcon({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(className)} strokeWidth={strokeWidth}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 19.5a6.5 6.5 0 0 1 13 0" />
      <path d="M16 5.5a3.2 3.2 0 0 1 0 5M17.5 19.5a6.6 6.6 0 0 0-2-4.7" />
    </svg>
  );
}

export function CalendarIcon({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(className)} strokeWidth={strokeWidth}>
      <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3.5v4M16 3.5v4" />
    </svg>
  );
}

export function TagIcon({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(className)} strokeWidth={strokeWidth}>
      <path d="M11 3.5H4.5a1 1 0 0 0-1 1V11l9 9 8-8Z" />
      <circle cx="8" cy="8" r="1.4" />
    </svg>
  );
}

export function SettingsIcon({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(className)} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1" />
    </svg>
  );
}

export function MegaphoneIcon({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(className)} strokeWidth={strokeWidth}>
      <path d="M3.5 10v4a1.5 1.5 0 0 0 1.5 1.5h2L15 20V4L7 8.5H5A1.5 1.5 0 0 0 3.5 10Z" />
      <path d="M18.5 9.5a3.5 3.5 0 0 1 0 5" />
      <path d="M7 15.5V20" />
    </svg>
  );
}

export function LogOutIcon({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(className)} strokeWidth={strokeWidth}>
      <path d="M14 4.5h4a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-4" />
      <path d="M10 8.5 6 12l4 3.5M6 12h9" />
    </svg>
  );
}

export function ShareIcon({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(className)} strokeWidth={strokeWidth}>
      <path d="M12 15V3.5M8.5 7 12 3.5 15.5 7" />
      <path d="M6 11.5H5A1.5 1.5 0 0 0 3.5 13v6A1.5 1.5 0 0 0 5 20.5h14a1.5 1.5 0 0 0 1.5-1.5v-6a1.5 1.5 0 0 0-1.5-1.5h-1" />
    </svg>
  );
}

export function AddSquareIcon({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(className)} strokeWidth={strokeWidth}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <path d="M12 8.5v7M8.5 12h7" />
    </svg>
  );
}

export function CopyIcon({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(className)} strokeWidth={strokeWidth}>
      <rect x="8.5" y="8.5" width="12" height="12" rx="2.5" />
      <path d="M15.5 8.5v-3a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" />
    </svg>
  );
}

/**
 * The Google "G".
 *
 * The only place in the app with literal colours outside the token file, and
 * deliberately so: Google's brand guidelines require these exact four values on
 * a sign-in button. They are not our design tokens and must not follow our
 * palette, in light mode or dark.
 */
export function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.5 5.5 0 0 1-2.39 3.6v3h3.86c2.26-2.08 3.56-5.15 3.56-8.79Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3c-1.07.72-2.44 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.28v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.28a12 12 0 0 0 0 10.78l4-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.61l4 3.1C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}
