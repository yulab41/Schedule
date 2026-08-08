export const colorTokens = {
  background: '#F5F7FA',
  border: '#E5E7EB',
  borderStrong: '#DBE3EA',
  danger: '#DC2626',
  dangerLight: '#FEF2F2',
  focusRing: '#1F5AA6',
  nearBlack: '#111827',
  primary: '#1F5AA6',
  primaryBorder: '#BFDBFE',
  primaryLight: '#EFF6FF',
  success: '#16A34A',
  successLight: '#F0FDF4',
  surface: '#FFFFFF',
  textMuted: '#6B7280',
  textPrimary: '#111827',
  textSecondary: '#4B5563',
  warning: '#B45309',
  warningLight: '#FEF3C7',
  weekend: '#C2185B',
  white: '#FFFFFF',
} as const;

export const spacingTokens = {
  none: '0',
  xxs: '4px',
  xs: '8px',
  sm: '12px',
  md: '16px',
  lg: '24px',
  xl: '32px',
} as const;

export const fontSizeTokens = {
  xs: '11px',
  sm: '13px',
  md: '14px',
  lg: '16px',
  xl: '18px',
  xxl: '24px',
} as const;

export const lineHeightTokens = {
  tight: '1.3',
  normal: '1.6',
} as const;

export const breakpointTokens = {
  mobile: 640,
  tablet: 768,
  desktop: 1024,
} as const;

export const layoutTokens = {
  bottomNavHeight: '64px',
  headerHeight: '56px',
  sidebarWidth: '240px',
} as const;

export const zIndexTokens = {
  drawer: 100,
  sticky: 10,
  dialog: 1000,
} as const;

export const durationTokens = {
  fast: '120ms',
  normal: '200ms',
} as const;

interface TokenGroup {
  readonly cssPrefix: string;
  readonly format: 'hex' | 'px' | 'plain';
  readonly tokens: Readonly<Record<string, string | number>>;
}

// Every CSS custom property name and value is derived from this list, so a token
// change only has to be made here instead of in both tokens.ts and tokens.css.
export const tokenGroups = [
  { cssPrefix: '--ui-color-', format: 'hex', tokens: colorTokens },
  { cssPrefix: '--ui-spacing-', format: 'plain', tokens: spacingTokens },
  { cssPrefix: '--ui-font-size-', format: 'plain', tokens: fontSizeTokens },
  { cssPrefix: '--ui-line-height-', format: 'plain', tokens: lineHeightTokens },
  { cssPrefix: '--ui-breakpoint-', format: 'px', tokens: breakpointTokens },
  { cssPrefix: '--ui-layout-', format: 'plain', tokens: layoutTokens },
  { cssPrefix: '--ui-z-index-', format: 'plain', tokens: zIndexTokens },
  { cssPrefix: '--ui-duration-', format: 'plain', tokens: durationTokens },
] as const satisfies readonly TokenGroup[];
