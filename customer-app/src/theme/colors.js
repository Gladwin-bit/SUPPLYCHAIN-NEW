// src/theme/colors.js - Design system matching the web app's dark aesthetic
export const COLORS = {
  // Backgrounds
  background: '#0a0a0f',
  surface: '#12121a',
  surfaceElevated: '#1a1a26',
  card: '#161622',

  // Gold accent (matches web app's --gold variable)
  gold: '#D4AF37',
  goldLight: '#F0D060',
  goldDark: '#B8961F',
  goldGlow: 'rgba(212, 175, 55, 0.15)',

  // Text
  textPrimary: '#f0f0f0',
  textSecondary: '#a0a0b0',
  textMuted: '#606070',

  // Status colors
  success: '#22c55e',
  successBg: 'rgba(34, 197, 94, 0.1)',
  error: '#ef4444',
  errorBg: 'rgba(239, 68, 68, 0.1)',
  warning: '#f59e0b',
  warningBg: 'rgba(245, 158, 11, 0.1)',
  info: '#3b82f6',
  infoBg: 'rgba(59, 130, 246, 0.1)',

  // Borders
  border: 'rgba(255, 255, 255, 0.08)',
  borderGold: 'rgba(212, 175, 55, 0.3)',

  // Glass effect
  glass: 'rgba(255, 255, 255, 0.04)',
  glassHover: 'rgba(255, 255, 255, 0.08)',

  // Gradients (used as array for LinearGradient)
  gradientGold: ['#D4AF37', '#F0D060'],
  gradientDark: ['#0a0a0f', '#12121a'],
  gradientSurface: ['#12121a', '#1a1a26'],
};

export const FONTS = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
  sizes: {
    xs: 11,
    sm: 13,
    base: 15,
    lg: 17,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.8,
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};
