/** Detect the original image format instead of trusting a data URI's MIME label. */
export function parseVisitorQrImage(
  base64: string,
):
  | { readonly base64: string; readonly imageSrc: string; readonly extension: 'png' | 'jpg' }
  | undefined {
  if (!base64 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(base64))
    return undefined;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const prefix: number[] = [];
  let bits = 0;
  let value = 0;
  for (const character of base64.slice(0, 12)) {
    if (character === '=') break;
    value = (value << 6) | alphabet.indexOf(character);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      prefix.push((value >> bits) & 255);
    }
  }
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => prefix[index] === byte);
  const jpeg = prefix[0] === 255 && prefix[1] === 216 && prefix[2] === 255;
  if (!png && !jpeg) return undefined;
  return {
    base64,
    imageSrc: `data:image/${png ? 'png' : 'jpeg'};base64,${base64}`,
    extension: png ? 'png' : 'jpg',
  };
}
