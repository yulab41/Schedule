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

/** Only the explicit save handler calls this. Never fetch, redraw, persist, or retry a QR. */
export async function saveVisitorQrImage(
  imageSrc: string,
  isCurrent: () => boolean,
): Promise<VisitorQrSaveResult> {
  if (!isCurrent()) return 'stale';
  const bytes = /^data:image\/png;base64,(iVBORw0KGgo[A-Za-z0-9+/]*={0,2})$/u.exec(imageSrc)?.[1];
  if (!bytes) return 'invalid-image';
  const runtime = wx as unknown as QrAlbumRuntime;
  let fs: QrFileSystem;
  let filePath: string;
  try {
    fs = runtime.getFileSystemManager();
    if (!runtime.env.USER_DATA_PATH) return 'write-failed';
    // Names contain no group, visitor key, invitation token, or other business material.
    filePath = `${runtime.env.USER_DATA_PATH}/visitor-qr-${Date.now()}-${++sequence}-${Math.random().toString(36).slice(2)}.png`;
  } catch {
    return 'write-failed';
  }
  let result: VisitorQrSaveResult = 'write-failed';
  let written = false;
  try {
    await new Promise<void>((resolve, reject) => {
      fs.writeFile({ filePath, data: bytes, encoding: 'base64', success: resolve, fail: reject });
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
