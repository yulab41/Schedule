export const colorTokens = {
  background: '#F4F7FB',
  border: '#DCE3EB',
  borderStrong: '#C5CDD6',
  danger: '#D92D20',
  dangerLight: '#FDECEA',
  focusRing: '#0A66D5',
  holidayBackground: '#FFF5F5',
  nearBlack: '#16202A',
  overlay: '#16202A',
  primary: '#0A66D5',
  primaryBorder: '#B9D8FF',
  primaryDark: '#084FA6',
  primaryLight: '#EAF3FF',
  success: '#248A3D',
  successLight: '#EAF8EF',
  surface: '#FFFFFF',
  surfaceMuted: '#F8FAFC',
  textMuted: '#788492',
  textPrimary: '#16202A',
  textSecondary: '#5E6A78',
  todayMarker: '#F5C518',
  warning: '#B86A00',
  warningLight: '#FFF4D6',
  weekend: '#E03131',
  white: '#FFFFFF',
} as const;

export const spacingTokens = {
  none: '0',
  xxs: '4px',
  xs: '8px',
  sm: '12px',
  md: '16px',
  lg: '20px',
  xl: '24px',
  xxl: '32px',
} as const;

export const fontSizeTokens = {
  xs: '11px',
  sm: '13px',
  md: '15px',
  lg: '17px',
  xl: '20px',
  xxl: '28px',
} as const;

export const fontFamilyTokens = {
  system:
    "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Segoe UI', 'Microsoft YaHei', sans-serif",
} as const;

export const fontWeightTokens = {
  medium: '550',
  regular: '400',
  semibold: '650',
  strong: '750',
} as const;

export const lineHeightTokens = {
  tight: '1.3',
  normal: '1.55',
  title: '1.18',
} as const;

export const radiusTokens = {
  large: '18px',
  medium: '14px',
  pill: '999px',
  small: '10px',
} as const;

export const shadowTokens = {
  card: '0 8px 24px rgb(22 32 42 / 7%)',
  elevated: '0 16px 40px rgb(22 32 42 / 14%)',
  focus: '0 0 0 3px rgb(10 102 213 / 12%)',
  primary: '0 8px 20px rgb(10 102 213 / 22%)',
} as const;

export const touchTargetTokens = {
  comfortable: '50px',
  minimum: '44px',
  navigation: '56px',
} as const;

export const breakpointTokens = {
  mobile: 640,
  tablet: 768,
  desktop: 1024,
} as const;

export const layoutTokens = {
  bottomNavHeight: '70px',
  headerHeight: '68px',
  sidebarWidth: '224px',
} as const;

export const zIndexTokens = {
  drawer: 100,
  navigation: 50,
  overlay: 90,
  sticky: 10,
  dialog: 1000,
} as const;

export const durationTokens = {
  fast: '120ms',
  normal: '200ms',
  slow: '320ms',
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
  { cssPrefix: '--ui-font-family-', format: 'plain', tokens: fontFamilyTokens },
  { cssPrefix: '--ui-font-size-', format: 'plain', tokens: fontSizeTokens },
  { cssPrefix: '--ui-font-weight-', format: 'plain', tokens: fontWeightTokens },
  { cssPrefix: '--ui-line-height-', format: 'plain', tokens: lineHeightTokens },
  { cssPrefix: '--ui-radius-', format: 'plain', tokens: radiusTokens },
  { cssPrefix: '--ui-shadow-', format: 'plain', tokens: shadowTokens },
  { cssPrefix: '--ui-touch-target-', format: 'plain', tokens: touchTargetTokens },
  { cssPrefix: '--ui-breakpoint-', format: 'px', tokens: breakpointTokens },
  { cssPrefix: '--ui-layout-', format: 'plain', tokens: layoutTokens },
  { cssPrefix: '--ui-z-index-', format: 'plain', tokens: zIndexTokens },
  { cssPrefix: '--ui-duration-', format: 'plain', tokens: durationTokens },
] as const satisfies readonly TokenGroup[];
