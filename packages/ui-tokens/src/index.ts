import {
  breakpointTokens,
  colorTokens,
  durationTokens,
  fontSizeTokens,
  layoutTokens,
  lineHeightTokens,
  spacingTokens,
  zIndexTokens,
} from './tokens.js';

export {
  breakpointTokens,
  colorTokens,
  durationTokens,
  fontSizeTokens,
  layoutTokens,
  lineHeightTokens,
  spacingTokens,
  zIndexTokens,
};

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
