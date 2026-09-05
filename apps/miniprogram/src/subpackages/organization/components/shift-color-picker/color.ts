// Kept in Web ShiftColorPicker order; the parity test reads that source directly.
export const SHIFT_COLOR_PRESETS = ['#0A66D5', '#287D70', '#4C5BD4', '#9A6A13', '#C33D56'];
export const FALLBACK_CUSTOM_COLOR = '#7A4FD6';

export interface RgbColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

export interface HsvColor {
  readonly hue: number;
  /** Saturation and value are fractions in [0, 1]; hue is in degrees. */
  readonly saturation: number;
  readonly value: number;
}

export function clamp(value: number, maximum = 1): number {
  return Number.isFinite(value) ? Math.min(maximum, Math.max(0, value)) : 0;
}

export function normalizeHex(value: string): string | undefined {
  const match = /^#?([0-9a-f]{6})$/iu.exec(value.trim());
  return match?.[1] === undefined ? undefined : `#${match[1].toUpperCase()}`;
}

export function hexToRgb(value: string): RgbColor | undefined {
  const hex = normalizeHex(value);
  if (hex === undefined) return undefined;
  return {
    red: Number.parseInt(hex.slice(1, 3), 16),
    green: Number.parseInt(hex.slice(3, 5), 16),
    blue: Number.parseInt(hex.slice(5, 7), 16),
  };
}

export function rgbToHex({ red, green, blue }: RgbColor): string {
  return `#${[red, green, blue].map((channel) => Math.round(clamp(channel, 255)).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

export function rgbToHsv(rgb: RgbColor): HsvColor {
  const red = clamp(rgb.red, 255) / 255;
  const green = clamp(rgb.green, 255) / 255;
  const blue = clamp(rgb.blue, 255) / 255;
  const maximum = Math.max(red, green, blue);
  const delta = maximum - Math.min(red, green, blue);
  let hue = 0;
  if (delta !== 0) {
    if (maximum === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (maximum === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  // Round only final RGB bytes. Rounding HSV loses valid colors such as #0F766E.
  return {
    hue: (hue + 360) % 360,
    saturation: maximum === 0 ? 0 : delta / maximum,
    value: maximum,
  };
}

export function hexToHsv(value: string): HsvColor | undefined {
  const rgb = hexToRgb(value);
  return rgb === undefined ? undefined : rgbToHsv(rgb);
}

export function hsvToRgb(hsv: HsvColor): RgbColor {
  const hue = Number.isFinite(hsv.hue) ? ((hsv.hue % 360) + 360) % 360 : 0;
  const value = clamp(hsv.value);
  const chroma = value * clamp(hsv.saturation);
  const segment = hue / 60;
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
  const offset = value - chroma;
  const channels =
    segment < 1
      ? [chroma, secondary, 0]
      : segment < 2
        ? [secondary, chroma, 0]
        : segment < 3
          ? [0, chroma, secondary]
          : segment < 4
            ? [0, secondary, chroma]
            : segment < 5
              ? [secondary, 0, chroma]
              : [chroma, 0, secondary];
  return {
    red: ((channels[0] ?? 0) + offset) * 255,
    green: ((channels[1] ?? 0) + offset) * 255,
    blue: ((channels[2] ?? 0) + offset) * 255,
  };
}

export function hsvToHex(hsv: HsvColor): string {
  return rgbToHex(hsvToRgb(hsv));
}

function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (rgb === undefined) return 0;
  const linear = [rgb.red, rgb.green, rgb.blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return (linear[0] ?? 0) * 0.2126 + (linear[1] ?? 0) * 0.7152 + (linear[2] ?? 0) * 0.0722;
}

/** Same white/near-black choice as Web ui-tokens, without importing its package. */
export function shiftColorPresentation(hex: string): {
  textColor: string;
  contrastWarning: boolean;
} {
  const background = luminance(hex);
  const dark = luminance('#16202A');
  const lightRatio = 1.05 / (background + 0.05);
  const darkRatio = (Math.max(background, dark) + 0.05) / (Math.min(background, dark) + 0.05);
  return {
    textColor: lightRatio >= darkRatio ? '#FFFFFF' : '#16202A',
    contrastWarning: Math.max(lightRatio, darkRatio) < 4.5,
  };
}
