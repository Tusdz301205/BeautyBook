/**
 * Berry Clarity design tokens. Pure TypeScript (no React Native imports) so
 * Node tests can load it directly. Contrast values are documented in
 * design-proposals/beautybook-mobile/2026-10-09-de-xuat-berry-clarity-v1.md §6.
 */

const palette = {
  berry: '#8D315B',
  berryPressed: '#70254A',
  berrySoft: '#F7E8EF',
  plum: '#3A2232',
  plumSoft: '#E9D5DF',
  coral: '#A8472F',
  coralSoft: '#FBEAE4',
  sage: '#3F6B5A',
  ivory: '#FBF7F3',
  white: '#FFFFFF',
  ink: '#2A1F26',
  inkBody: '#4A3F46',
  inkSecondary: '#6B5F66',
  inkDisabled: '#857980',
  line: '#E7DCD8',
  lineStrong: '#8C7F86',
  divider: '#EFE7E3',
  muted: '#F3ECE7',
  mutedStrong: '#EFE8E5',
};

export const colors = {
  primary: palette.berry,
  primaryPressed: palette.berryPressed,
  primarySoft: palette.berrySoft,
  onPrimary: palette.white,
  secondary: palette.plum,
  secondarySoft: palette.plumSoft,
  onSecondary: palette.white,
  accent: palette.coral,
  accentSoft: palette.coralSoft,
  sage: palette.sage,

  background: palette.ivory,
  surface: palette.white,
  surfaceMuted: palette.muted,
  surfacePressed: palette.muted,
  border: palette.line,
  borderStrong: palette.lineStrong,
  divider: palette.divider,

  heading: palette.ink,
  body: palette.inkBody,
  secondaryText: palette.inkSecondary,
  disabledText: palette.inkDisabled,
  disabledSurface: palette.mutedStrong,

  success: '#2E6A47',
  successSoft: '#E4F2E8',
  warning: '#7A4E0A',
  warningSoft: '#FBF0DA',
  error: '#A12A22',
  errorSoft: '#FBE7E4',
  info: '#255A86',
  infoSoft: '#E6EFF8',

  overlay: 'rgba(42,31,38,0.48)',
  scrim: 'rgba(42,31,38,0.62)',
  skeleton: palette.mutedStrong,

  white: palette.white,
  black: '#000000',

  // Legacy aliases kept so untouched modules keep compiling with new values.
  primaryLight: palette.berrySoft,
  orange: '#7A4E0A',
  discountRed: '#A12A22',
  ratingGreen: '#2E6A47',
  bookingTag: '#2E6A47',
  reviewTag: '#255A86',
  textDark: palette.ink,
  textBody: palette.inkBody,
  textGray: palette.inkSecondary,
  textMuted: palette.inkDisabled,
  card: palette.white,
};

export type Tone = 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'danger' | 'request' | 'arrived';

export const tones: Record<Tone, { fg: string; bg: string; border: string }> = {
  neutral: { fg: '#5E545A', bg: '#EEE8E6', border: '#D9CFCC' },
  brand: { fg: palette.berry, bg: palette.berrySoft, border: '#E3C3D2' },
  info: { fg: '#255A86', bg: '#E6EFF8', border: '#C3D6EA' },
  success: { fg: '#2E6A47', bg: '#E4F2E8', border: '#C2DFCB' },
  warning: { fg: '#7A4E0A', bg: '#FBF0DA', border: '#EBD3A4' },
  danger: { fg: '#A12A22', bg: '#FBE7E4', border: '#EDC1BB' },
  request: { fg: '#55468A', bg: '#EEEAF8', border: '#D3CBEB' },
  arrived: { fg: '#1F6B5C', bg: '#E0F2ED', border: '#BADFD4' },
};

/** Booking lifecycle → tone + icon. Colour is never the only signal. */
export const bookingTone: Record<string, { tone: Tone; icon: string }> = {
  PENDING: { tone: 'warning', icon: 'time-outline' },
  CONFIRMED: { tone: 'info', icon: 'checkmark-circle-outline' },
  CHECKED_IN: { tone: 'arrived', icon: 'enter-outline' },
  IN_PROGRESS: { tone: 'brand', icon: 'play-circle-outline' },
  COMPLETED: { tone: 'success', icon: 'checkmark-done-outline' },
  CANCELLED: { tone: 'neutral', icon: 'close-circle-outline' },
  EXPIRED: { tone: 'neutral', icon: 'hourglass-outline' },
  REJECTED: { tone: 'danger', icon: 'alert-circle-outline' },
  NO_SHOW: { tone: 'danger', icon: 'alert-circle-outline' },
};

export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 40 };

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, sheet: 24, pill: 999 };

export const layout = {
  gutter: 16,
  sectionGap: 28,
  denseSectionGap: 20,
  cardPadding: 16,
  touch: 48,
  buttonMinHeight: 52,
  buttonCompactMinHeight: 48,
  inputMinHeight: 52,
  headerMinHeight: 56,
  tabBarMinHeight: 64,
  iconSm: 16,
  iconMd: 20,
  iconLg: 24,
};

const tabular = ['tabular-nums'] as ('tabular-nums')[];

export const type = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const, letterSpacing: -0.3, color: colors.heading },
  h1: { fontSize: 24, lineHeight: 30, fontWeight: '700' as const, letterSpacing: -0.2, color: colors.heading },
  h2: { fontSize: 20, lineHeight: 26, fontWeight: '700' as const, color: colors.heading },
  h3: { fontSize: 17, lineHeight: 23, fontWeight: '600' as const, color: colors.heading },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const, color: colors.body },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '600' as const, color: colors.heading },
  secondary: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const, color: colors.secondaryText },
  secondaryStrong: { fontSize: 14, lineHeight: 20, fontWeight: '600' as const, color: colors.body },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const, letterSpacing: 0.2, color: colors.secondaryText },
  overline: { fontSize: 12, lineHeight: 16, fontWeight: '700' as const, letterSpacing: 0.4, color: colors.secondaryText },
  button: { fontSize: 16, lineHeight: 22, fontWeight: '600' as const },
  tab: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 0.1 },
  numeric: { fontSize: 26, lineHeight: 32, fontWeight: '700' as const, letterSpacing: -0.2, color: colors.heading, fontVariant: tabular },
  clock: { fontSize: 16, lineHeight: 22, fontWeight: '700' as const, color: colors.heading, fontVariant: tabular },
  price: { fontSize: 16, lineHeight: 22, fontWeight: '700' as const, color: colors.heading, fontVariant: tabular },
};

export const elevation = {
  card: { shadowColor: palette.ink, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  raised: { shadowColor: palette.ink, shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: -2 }, elevation: 8 },
};

export const theme = { colors, tones, bookingTone, space, radius, layout, type, elevation };
export default theme;
