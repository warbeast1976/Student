export const Radii = {
  sm: 10,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const Spacing = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const Motion = {
  enterFast: 260,
  enterMedium: 340,
  pressScale: 0.98,
} as const;

export const Shadows = {
  xs: {
    shadowColor: '#0C1222',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  sm: {
    shadowColor: '#0C1222',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  md: {
    shadowColor: '#0C1222',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
} as const;

export const BrandGradients = {
  lightHero: ['#14B8A6', '#0D9488', '#0F766E'],
  darkHero: ['#5EEAD4', '#2DD4BF', '#14B8A6'],
} as const;
