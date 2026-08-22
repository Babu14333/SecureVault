export type AccentColorKey = 'indigo' | 'emerald' | 'violet' | 'amber' | 'crimson';
export type ThemeMode = 'light' | 'dark' | 'system';

export const AccentPalettes: Record<
  AccentColorKey,
  {
    name: string;
    primary: string;
    primaryLight: string;
    primaryDark: string;
    primaryBg: string;
  }
> = {
  indigo: {
    name: 'Sapphire Blue',
    primary: '#2563EB',
    primaryLight: '#60A5FA',
    primaryDark: '#1D4ED8',
    primaryBg: 'rgba(37, 99, 235, 0.08)',
  },
  emerald: {
    name: 'Cyber Emerald',
    primary: '#059669',
    primaryLight: '#34D399',
    primaryDark: '#047857',
    primaryBg: 'rgba(5, 150, 105, 0.08)',
  },
  violet: {
    name: 'Electric Violet',
    primary: '#7C3AED',
    primaryLight: '#A78BFA',
    primaryDark: '#6D28D9',
    primaryBg: 'rgba(124, 58, 237, 0.08)',
  },
  amber: {
    name: 'Amber Gold',
    primary: '#D97706',
    primaryLight: '#FBBF24',
    primaryDark: '#B45309',
    primaryBg: 'rgba(217, 119, 6, 0.08)',
  },
  crimson: {
    name: 'Crimson Red',
    primary: '#E11D48',
    primaryLight: '#FB7185',
    primaryDark: '#BE123C',
    primaryBg: 'rgba(225, 29, 72, 0.08)',
  },
};

export const BaseColors = {
  light: {
    background: '#FFFFFF',
    backgroundAlt: '#F8FAFC',
    card: '#FFFFFF',
    cardAlt: '#F8FAFC',
    text: '#0F172A',
    textSecondary: '#475569',
    textTertiary: '#94A3B8',
    border: '#E2E8F0',
    borderLight: '#F1F5F9',
    success: '#059669',
    successBg: '#ECFDF5',
    warning: '#D97706',
    warningBg: '#FFFBEB',
    danger: '#DC2626',
    dangerBg: '#FEF2F2',
    info: '#0284C7',
    infoBg: '#F0F9FF',
    overlay: 'rgba(15, 23, 42, 0.45)',
    shadow: 'rgba(15, 23, 42, 0.05)',
    inputBg: '#F8FAFC',
    tabBar: '#FFFFFF',
    tabBarBorder: '#E2E8F0',
    statusBar: 'dark-content',
  },
  dark: {
    background: '#090D16',
    backgroundAlt: '#111827',
    card: '#111827',
    cardAlt: '#1E293B',
    text: '#F9FAFB',
    textSecondary: '#9CA3AF',
    textTertiary: '#6B7280',
    border: '#1F2937',
    borderLight: '#111827',
    success: '#10B981',
    successBg: 'rgba(16, 185, 129, 0.15)',
    warning: '#F59E0B',
    warningBg: 'rgba(245, 158, 11, 0.15)',
    danger: '#EF4444',
    dangerBg: 'rgba(239, 68, 68, 0.15)',
    info: '#06B6D4',
    infoBg: 'rgba(6, 182, 212, 0.15)',
    overlay: 'rgba(0, 0, 0, 0.75)',
    shadow: 'rgba(0, 0, 0, 0.4)',
    inputBg: '#131C2E',
    tabBar: '#0F172A',
    tabBarBorder: '#1E293B',
    statusBar: 'light-content',
  },
} as const;

export const Colors = BaseColors;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
} as const;

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
} as const;

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

