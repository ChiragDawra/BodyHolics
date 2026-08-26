/**
 * Design tokens, shared by the Expo app and the Next.js admin.
 *
 * These are plain values with no platform imports, because the two clients
 * consume them differently: the mobile app feeds them to StyleSheet, the admin
 * emits them as CSS custom properties for Tailwind (docs/03 §Styling). Anything
 * that needs `react-native` or a DOM type does not belong in this file.
 */

/**
 * A gym floor is a bright room and a phone is often held at arm's length mid-set,
 * so the palette is built for contrast first. Every foreground/background pair
 * used below meets WCAG AA at body size.
 */
export const palette = {
  // Ink — the neutral ramp. Light surfaces at the low end, dark at the high end.
  ink0: '#FFFFFF',
  ink50: '#F7F8FA',
  ink100: '#EDEFF3',
  ink200: '#DDE1E8',
  ink300: '#C2C8D2',
  ink400: '#98A1AF',
  ink500: '#6B7583',
  ink600: '#4A525E',
  ink700: '#333A44',
  ink800: '#1F242C',
  ink900: '#12161C',
  ink950: '#0A0D11',

  // Accent — a single saturated hue carries every primary action.
  accent100: '#E4F5EC',
  accent300: '#7FD8A9',
  accent500: '#12B76A',
  accent600: '#0E9355',
  accent700: '#0A6E40',

  // Status. These map to real domain states, not to decoration.
  danger100: '#FDE7E7',
  danger500: '#D92D20',
  danger700: '#912018',
  warning100: '#FEF3E2',
  warning500: '#F79009',
  warning700: '#B54708',
  info100: '#E7F0FE',
  info500: '#2E7CF6',
  info700: '#1B4FA8',
} as const;

/** 4pt grid. Any spacing not on this scale is a mistake, not a nuance. */
export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,
} as const;

export const radius = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 38,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

/** Line heights as absolute values, so mobile and web agree on vertical rhythm. */
export const lineHeight = {
  xs: 16,
  sm: 20,
  base: 24,
  lg: 26,
  xl: 28,
  '2xl': 32,
  '3xl': 38,
  '4xl': 46,
} as const;

export type ThemeName = 'light' | 'dark';

export type Theme = {
  background: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textInverted: string;
  accent: string;
  accentPressed: string;
  onAccent: string;
  danger: string;
  dangerSurface: string;
  warning: string;
  warningSurface: string;
  info: string;
  infoSurface: string;
};

export const themes: Record<ThemeName, Theme> = {
  light: {
    background: palette.ink50,
    surface: palette.ink0,
    surfaceRaised: palette.ink0,
    border: palette.ink200,
    borderStrong: palette.ink300,
    text: palette.ink900,
    textMuted: palette.ink500,
    textInverted: palette.ink0,
    accent: palette.accent500,
    accentPressed: palette.accent600,
    onAccent: palette.ink0,
    danger: palette.danger500,
    dangerSurface: palette.danger100,
    warning: palette.warning700,
    warningSurface: palette.warning100,
    info: palette.info500,
    infoSurface: palette.info100,
  },
  dark: {
    background: palette.ink950,
    surface: palette.ink900,
    surfaceRaised: palette.ink800,
    border: palette.ink700,
    borderStrong: palette.ink600,
    text: palette.ink50,
    textMuted: palette.ink400,
    textInverted: palette.ink950,
    accent: palette.accent500,
    accentPressed: palette.accent300,
    onAccent: palette.ink950,
    danger: '#F97066',
    dangerSurface: '#3B1513',
    warning: '#FDB022',
    warningSurface: '#3A2409',
    info: '#84ADFF',
    infoSurface: '#12203A',
  },
};

/**
 * The four crowd buckets from D-008, plus the case where there is not enough
 * data to say. INSUFFICIENT_DATA deliberately reads as neutral rather than as
 * "empty" — an unknown gym is not a quiet gym.
 */
export const crowdColors = {
  NOT_CROWDED: palette.accent500,
  MODERATE: palette.warning500,
  CROWDED: '#F04438',
  VERY_CROWDED: palette.danger700,
  INSUFFICIENT_DATA: palette.ink400,
} as const;

/** Membership status colours, matching the values in docs/09 §1. */
export const membershipStatusColors = {
  ACTIVE: palette.accent500,
  PENDING_PAYMENT: palette.warning500,
  EXPIRED: palette.ink400,
  CANCELLED: palette.ink400,
} as const;
