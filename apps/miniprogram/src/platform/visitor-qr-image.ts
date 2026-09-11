interface NativeCallbacks {
  success: () => void;
  fail: (error: unknown) => void;
}

interface QrFileSystem {
  writeFile(
    options: NativeCallbacks & { filePath: string; data: string; encoding: 'base64' },
  ): void;
  unlink(options: NativeCallbacks & { filePath: string }): void;
}

interface QrAlbumRuntime {
  env: { USER_DATA_PATH: string };
  getFileSystemManager(): QrFileSystem;
  saveImageToPhotosAlbum(options: NativeCallbacks & { filePath: string }): void;
}

export type VisitorQrSaveResult =
  | 'saved'
  | 'cancelled'
  | 'stale'
  | 'permission-denied'
  | 'invalid-image'
  | 'write-failed'
  | 'save-failed'
  | 'cleanup-failed';

let sequence = 0;

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

/** Only the explicit save handler calls this. Never fetch, redraw, persist, or retry a QR. */
export async function saveVisitorQrImage(
  imageSrc: string,
  isCurrent: () => boolean,
): Promise<VisitorQrSaveResult> {
  if (!isCurrent()) return 'stale';
  const base64 = /^data:image\/(?:png|jpeg);base64,(.*)$/u.exec(imageSrc)?.[1];
  const image = base64 === undefined ? undefined : parseVisitorQrImage(base64);
  if (!image) return 'invalid-image';
  const runtime = wx as unknown as QrAlbumRuntime;
  let fs: QrFileSystem;
  let filePath: string;
  try {
    fs = runtime.getFileSystemManager();
    if (!runtime.env.USER_DATA_PATH) return 'write-failed';
    // Names contain no group, visitor key, invitation token, or other business material.
    filePath = `${runtime.env.USER_DATA_PATH}/visitor-qr-${Date.now()}-${++sequence}-${Math.random().toString(36).slice(2)}.${image.extension}`;
  } catch {
    return 'write-failed';
  }
  let result: VisitorQrSaveResult = 'write-failed';
  let written = false;
  try {
    await new Promise<void>((resolve, reject) => {
      fs.writeFile({
        filePath,
        data: image.base64,
        encoding: 'base64',
        success: resolve,
        fail: reject,
      });
    });
    written = true;
    if (!isCurrent()) result = 'stale';
    else {
      try {
        await new Promise<void>((resolve, reject) => {
          runtime.saveImageToPhotosAlbum({ filePath, success: resolve, fail: reject });
        });
        result = 'saved';
      } catch (error) {
        const message = nativeMessage(error);
        result = /cancel/iu.test(message)
          ? 'cancelled'
          : /auth\s*deny|auth.*denied|authorize no response|permission|system denied/iu.test(
                message,
              )
            ? 'permission-denied'
            : 'save-failed';
      }
    }
  } catch {
    result = 'write-failed';
  } finally {
    // Also attempt unlink after partial/failed writes; never mask an absent partial file.
    try {
      await new Promise<void>((resolve, reject) => {
        fs.unlink({ filePath, success: resolve, fail: reject });
      });
    } catch (error) {
      if (written || !/no such file|not exist|enoent/iu.test(nativeMessage(error))) {
        result = 'cleanup-failed';
      }
    }
  }
  return result;
}

function nativeMessage(error: unknown): string {
  if (typeof error !== 'object' || error === null || !('errMsg' in error)) return '';
  return typeof error.errMsg === 'string' ? error.errMsg : '';
}
