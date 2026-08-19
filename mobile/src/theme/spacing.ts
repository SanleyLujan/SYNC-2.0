export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
} as const;

export const fontSize = {
  caption: 12,
  xs: 12,
  small: 14,
  sm: 14,
  body: 16,
  md: 16,
  cardTitle: 18,
  lg: 18,
  h3: 20,
  xl: 24,
  h2: 24,
  h1: 32,
  xxl: 32,
  display: 36,
  title: 36,
} as const;

export const typography = {
  fontFamily: 'Poppins, Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  display: { fontSize: fontSize.display, fontWeight: '700' as const, lineHeight: 42 },
  h1: { fontSize: fontSize.h1, fontWeight: '700' as const, lineHeight: 38 },
  h2: { fontSize: fontSize.h2, fontWeight: '600' as const, lineHeight: 30 },
  h3: { fontSize: fontSize.h3, fontWeight: '600' as const, lineHeight: 26 },
  cardTitle: { fontSize: fontSize.cardTitle, fontWeight: '600' as const, lineHeight: 24 },
  body: { fontSize: fontSize.body, fontWeight: '400' as const, lineHeight: 22 },
  small: { fontSize: fontSize.small, fontWeight: '400' as const, lineHeight: 20 },
  caption: { fontSize: fontSize.caption, fontWeight: '500' as const, lineHeight: 16 },
} as const;
