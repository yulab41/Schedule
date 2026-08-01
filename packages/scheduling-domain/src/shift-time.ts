export function calculateShiftEndDate(startDate: string, crossesMidnight: boolean): string {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  if (Number.isNaN(start.valueOf())) {
    throw new Error('Shift start date must use the YYYY-MM-DD format.');
  }

  if (crossesMidnight) {
    start.setUTCDate(start.getUTCDate() + 1);
  }

  return start.toISOString().slice(0, 10);
}

export function calculateReadableTextColor(color: string): '#111827' | '#FFFFFF' {
  const match = /^#([\dA-F]{2})([\dA-F]{2})([\dA-F]{2})$/iu.exec(color);
  if (match === null) {
    throw new Error('Shift color must use the #RRGGBB format.');
  }

  const red = toLinearColorChannel(match[1]!);
  const green = toLinearColorChannel(match[2]!);
  const blue = toLinearColorChannel(match[3]!);
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;

  return luminance > 0.179 ? '#111827' : '#FFFFFF';
}

function toLinearColorChannel(channel: string): number {
  const normalized = Number.parseInt(channel, 16) / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}
