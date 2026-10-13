/**
 * Berry Bloom design tokens. Pure TypeScript (no React Native imports) so Node
 * tests can load it directly. Contrast ratios (WCAG 2.x relative luminance) are
 * recorded in mobile/docs/REDESIGN-BERRY-BLOOM.md.
 *
 * Colour roles:
 *  - berry  = action + selection (CTA, selected chip/date/slot/tab)
 *  - plum   = brand surfaces (hero headers, next-appointment card)
 *  - peach / lavender / sage / gold / sky = supporting families with a fixed
 *    meaning (service families and booking states), never random per card.
 */

const palette = {
  berry: '#B4235F',
  berryPressed: '#8C1848',
  berrySoft: '#FCE4EC',
  berryTint: '#FFF1F6',
  plum: '#3A1446',
  plumMid: '#5E1F66',
  plumSoft: '#EBD6F0',
  peach: '#A63A1B',
  peachFill: '#FFB59C',
  peachSoft: '#FFE8DE',
  lavender: '#5236A6',
  lavenderFill: '#BCA9F3',
  lavenderSoft: '#EDE7FD',
  sage: '#1F6B4A',
  sageFill: '#9BD6BA',
  sageSoft: '#E0F4EA',
  gold: '#7A5200',
  goldFill: '#F6BD4F',
  goldSoft: '#FFF1D1',
  sky: '#1F5C8A',
  skySoft: '#E3F0FB',
  teal: '#17685C',
  tealSoft: '#DDF3EE',
  blush: '#FFF8F5',
  white: '#FFFFFF',
  ink: '#2A1230',
  inkBody: '#4A3550',
  inkSecondary: '#6D5873',
  inkDisabled: '#8C7A90',
  line: '#EFDDE3',
  lineStrong: '#93798A',
  divider: '#F3E6EA',
  muted: '#F8EEF0',
  pressed: '#F6E6EC',
  disabledSurface: '#EFE6EB',
};

export const colors = {
  primary: palette.berry,
  primaryPressed: palette.berryPressed,
  primarySoft: palette.berrySoft,
  primaryTint: palette.berryTint,
  onPrimary: palette.white,
  secondary: palette.plum,
  secondaryMid: palette.plumMid,
  secondarySoft: palette.plumSoft,
  onSecondary: palette.white,
  accent: palette.peach,
  accentFill: palette.peachFill,
  accentSoft: palette.peachSoft,
  lavender: palette.lavender,
  lavenderFill: palette.lavenderFill,
  lavenderSoft: palette.lavenderSoft,
  sage: palette.sage,
  sageFill: palette.sageFill,
  sageSoft: palette.sageSoft,
  gold: palette.gold,
  goldFill: palette.goldFill,
  goldSoft: palette.goldSoft,

  background: palette.blush,
  surface: palette.white,
  surfaceMuted: palette.muted,
  surfacePressed: palette.pressed,
  border: palette.line,
  borderStrong: palette.lineStrong,
  divider: palette.divider,

  heading: palette.ink,
  body: palette.inkBody,
  secondaryText: palette.inkSecondary,
  disabledText: palette.inkDisabled,
  disabledSurface: palette.disabledSurface,

  success: palette.sage,
  successSoft: palette.sageSoft,
  warning: palette.gold,
  warningSoft: palette.goldSoft,
  error: '#A8261C',
  errorSoft: '#FDE7E5',
  info: palette.sky,
  infoSoft: palette.skySoft,

  overlay: 'rgba(42,18,48,0.52)',
  scrim: 'rgba(42,18,48,0.66)',
  skeleton: palette.disabledSurface,

  white: palette.white,
  black: '#000000',
};

/** Gradient stops (start → end). Used for brand surfaces only, never behind body text below AA. */
export const gradients = {
  brand: ['#3A1446', '#7B1D62', '#B4235F'] as const,
  dusk: ['#5E1F66', '#3A1446'] as const,
  bloom: ['#B4235F', '#8A2590'] as const,
  sunrise: ['#FFB59C', '#F58FB0'] as const,
  blush: ['#FFE8DE', '#FCE4EC'] as const,
  lilac: ['#EDE7FD', '#FCE4EC'] as const,
};

export type Tone = 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'danger' | 'request' | 'arrived';

export const tones: Record<Tone, { fg: string; bg: string; border: string }> = {
  neutral: { fg: '#5A4A5E', bg: '#F1E8EE', border: '#DFD0DA' },
  brand: { fg: '#A61E5A', bg: palette.berrySoft, border: '#F3BFD3' },
  info: { fg: palette.sky, bg: palette.skySoft, border: '#BCD8F0' },
  success: { fg: palette.sage, bg: palette.sageSoft, border: '#B5E0C9' },
  warning: { fg: palette.gold, bg: palette.goldSoft, border: '#F0D48F' },
  danger: { fg: '#A8261C', bg: '#FDE7E5', border: '#F3BDB8' },
  request: { fg: palette.lavender, bg: palette.lavenderSoft, border: '#CFC2F5' },
  arrived: { fg: palette.teal, bg: palette.tealSoft, border: '#B0E0D6' },
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

export type FamilyKey = 'hair' | 'nails' | 'skin' | 'spa' | 'glow' | 'brow';

/** Service families: one fixed tint per kind of care, so colour helps recognition. */
export const families: Record<FamilyKey, { fg: string; soft: string; fill: string; icon: string; stops: readonly [string, string] }> = {
  hair: { fg: palette.lavender, soft: palette.lavenderSoft, fill: palette.lavenderFill, icon: 'cut-outline', stops: ['#D9CCFA', '#F3C6E3'] },
  nails: { fg: '#A61E5A', soft: palette.berrySoft, fill: '#F59ABB', icon: 'color-palette-outline', stops: ['#FBC4D8', '#FFD9C9'] },
  skin: { fg: palette.peach, soft: palette.peachSoft, fill: palette.peachFill, icon: 'water-outline', stops: ['#FFD3C2', '#FFE7B8'] },
  spa: { fg: palette.sage, soft: palette.sageSoft, fill: palette.sageFill, icon: 'leaf-outline', stops: ['#BFE6D2', '#DCEBFA'] },
  glow: { fg: palette.gold, soft: palette.goldSoft, fill: palette.goldFill, icon: 'sparkles-outline', stops: ['#FBE2A6', '#FFD3C2'] },
  brow: { fg: palette.sky, soft: palette.skySoft, fill: '#9CC8EE', icon: 'eye-outline', stops: ['#C9E1F7', '#E3DAFB'] },
};

/** Deterministic family from a Vietnamese/English category or service name. */
export function familyOf(name?: string | null): FamilyKey {
  const label = (name ?? '').toLocaleLowerCase('vi-VN');
  if (/mi\b|mày|môi|trang điểm|makeup|lash|brow|phun|xăm/.test(label)) return 'brow';
  if (/tóc|gội|hair|barber|râu|uốn|nhuộm|duỗi/.test(label)) return 'hair';
  if (/móng|nail|gel|sơn/.test(label)) return 'nails';
  if (/spa|massage|mát-xa|mát xa|thư giãn|body|xông|dưỡng sinh/.test(label)) return 'spa';
  if (/da\b|da |facial|skin|mụn|trị liệu|chăm sóc mặt|peel/.test(label)) return 'skin';
  return 'glow';
}

export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 40 };

export const radius = { sm: 8, md: 12, lg: 18, xl: 24, sheet: 28, pill: 999 };

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

/**
 * Brand typefaces (loaded in App.tsx): Fraunces for display, Be Vietnam Pro for
 * everything else — the same pairing as the web (docs/design.md). Each weight is
 * its own family, so styles pick a family and never set fontWeight (which would
 * synthesise a second bold on top of the real one).
 */
export const fonts = {
  regular: 'BeVietnamPro_400Regular',
  medium: 'BeVietnamPro_500Medium',
  semibold: 'BeVietnamPro_600SemiBold',
  bold: 'BeVietnamPro_700Bold',
  display: 'Fraunces_600SemiBold',
};

/** Weight overrides for inline use: `{ ...type.caption, ...fw.semibold }`. */
export const fw = {
  regular: { fontFamily: fonts.regular },
  medium: { fontFamily: fonts.medium },
  semibold: { fontFamily: fonts.semibold },
  bold: { fontFamily: fonts.bold },
  display: { fontFamily: fonts.display },
};

const tabular = ['tabular-nums'] as ('tabular-nums')[];

export const type = {
  display: { fontFamily: fonts.display, fontSize: 30, lineHeight: 38, letterSpacing: -0.2, color: colors.heading },
  h1: { fontFamily: fonts.display, fontSize: 26, lineHeight: 34, letterSpacing: -0.1, color: colors.heading },
  h2: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 28, color: colors.heading },
  h3: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 24, color: colors.heading },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.body },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 24, color: colors.heading },
  secondary: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.secondaryText },
  secondaryStrong: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 21, color: colors.body },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 17, letterSpacing: 0.1, color: colors.secondaryText },
  overline: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 17, letterSpacing: 0.5, color: colors.secondaryText },
  button: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  tab: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16 },
  numeric: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 34, letterSpacing: -0.2, color: colors.heading, fontVariant: tabular },
  clock: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22, color: colors.heading, fontVariant: tabular },
  price: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22, color: colors.heading, fontVariant: tabular },
};

export const elevation = {
  card: { shadowColor: palette.plum, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  raised: { shadowColor: palette.plum, shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: -3 }, elevation: 10 },
  float: { shadowColor: palette.plum, shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
};

export const theme = { colors, gradients, tones, bookingTone, families, familyOf, space, radius, layout, fonts, fw, type, elevation };
export default theme;
