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

export interface RgbColor {
  readonly b: number;
  readonly g: number;
  readonly r: number;
}

export function parseHexColor(value: string): RgbColor | undefined {
  const match = /^#([\da-f]{6})$/iu.exec(value.trim());
  if (match === null) {
    return undefined;
  }

  const hex = match[1] ?? '';
  return {
    b: Number.parseInt(hex.slice(4, 6), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    r: Number.parseInt(hex.slice(0, 2), 16),
  };
}

function relativeLuminance(color: RgbColor): number {
  const channel = (value: number): number => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

export function calculateContrastRatio(foreground: string, background: string): number {
  const foregroundRgb = parseHexColor(foreground);
  const backgroundRgb = parseHexColor(background);
  if (foregroundRgb === undefined || backgroundRgb === undefined) {
    throw new Error('Contrast calculation requires two #RRGGBB colors.');
  }

  const lighter = Math.max(relativeLuminance(foregroundRgb), relativeLuminance(backgroundRgb));
  const darker = Math.min(relativeLuminance(foregroundRgb), relativeLuminance(backgroundRgb));

  return (lighter + 0.05) / (darker + 0.05);
}

export function isTextReadable(
  foreground: string,
  background: string,
  minimumRatio = 4.5,
): boolean {
  return calculateContrastRatio(foreground, background) >= minimumRatio;
}

export function pickReadableTextColor(
  background: string,
  lightText = colorTokens.white,
  darkText = colorTokens.nearBlack,
): string {
  return calculateContrastRatio(lightText, background) >=
    calculateContrastRatio(darkText, background)
    ? lightText
    : darkText;
}

export function getBestContrastRatio(background: string): number {
  const lightRatio = calculateContrastRatio(colorTokens.white, background);
  const darkRatio = calculateContrastRatio(colorTokens.nearBlack, background);
  return Math.max(lightRatio, darkRatio);
}
