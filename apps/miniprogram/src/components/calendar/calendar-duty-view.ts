export function calendarShiftBadge(
  abbreviation: string,
  name: string,
  color?: string,
  textColor?: string,
) {
  const label = (abbreviation + name).match(/[\u3400-\u9fff]/u)?.[0] ?? '班';
  const background = /^#[\da-f]{6}$/iu.test(color ?? '') ? color! : '#267d70';
  const foreground = /^#[\da-f]{6}$/iu.test(textColor ?? '') ? textColor! : '#ffffff';
  return {
    abbreviation: label,
    badgeStyle: `background-color:${background};border-color:${background};color:${foreground};`,
  };
}
