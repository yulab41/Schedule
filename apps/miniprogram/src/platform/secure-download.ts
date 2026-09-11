import { requireClientCapability } from '../app/client-capability-store.js';
import { buildInfo } from './build-info.js';
import type { RuntimeWechatRequestAuthentication } from './client-core-calendar.js';

interface WxDownloadFileSuccess {
  readonly statusCode: number;
  readonly tempFilePath: string;
}

interface WxDownloadFileOptions {
  readonly fail: (error: unknown) => void;
  readonly header: Readonly<Record<string, string>>;
  readonly success: (result: WxDownloadFileSuccess) => void;
  readonly timeout: number;
  readonly url: string;
}

const DOWNLOAD_TIMEOUT_MS = 30_000;

type DownloadFailureCategory =
  'domain' | 'timeout' | 'tls' | 'network' | 'http' | 'empty' | 'unknown';

export class ScheduleExportDownloadError extends Error {
  constructor(
    readonly category: DownloadFailureCategory,
    readonly statusCode?: number,
  ) {
    const messages: Record<DownloadFailureCategory, string> = {
      domain: '微信下载域名校验失败，请联系管理员配置。',
      timeout: '导出文件下载超时，请稍后重试。',
      tls: '下载安全连接失败，请联系管理员检查证书。',
      network: '下载网络连接失败，请检查网络后重试。',
      http:
        statusCode === 401
          ? '登录已失效，请重新登录后下载。'
          : statusCode === 403
            ? '当前账号无权下载此文件。'
            : statusCode === 404 || statusCode === 410
              ? '导出文件已失效，请重新开始生成。'
              : statusCode === 426
                ? '请更新小程序后下载。'
                : '服务器暂时无法提供文件，请稍后重试。',
      empty: '下载未返回有效文件，请重试。',
      unknown: '导出文件下载失败，请稍后重试。',
    };
    super(`${messages[category]}${statusCode === undefined ? '' : `（HTTP ${statusCode}）`}`);
    this.name = 'ScheduleExportDownloadError';
  }
}

function nativeErrorMessage(error: unknown): string {
  if (typeof error !== 'object' || error === null || !('errMsg' in error)) return '';
  return typeof error.errMsg === 'string' ? error.errMsg : '';
}

function downloadFailure(error: unknown): ScheduleExportDownloadError {
  const message = nativeErrorMessage(error);
  const category = /domain|域名/i.test(message)
    ? 'domain'
    : /timeout|timed out/i.test(message)
      ? 'timeout'
      : /ssl|tls|certificate/i.test(message)
        ? 'tls'
        : /network|connect|offline|internet|dns|resolve host/i.test(message)
          ? 'network'
          : 'unknown';
  // Keep only an allowlisted category; native errors may contain URLs or credentials.
  return new ScheduleExportDownloadError(category);
}

export function releaseTemporaryExport(filePath: string | undefined): void {
  if (!filePath) return;
  try {
    (
      wx as unknown as {
        getFileSystemManager: () => {
          unlink: (options: { filePath: string; fail: () => void }) => void;
        };
      }
    )
      .getFileSystemManager()
      .unlink({ filePath, fail: () => undefined });
  } catch {
    // Native temp files also expire automatically; cleanup must never expose a path or mask a result.
  }
}

interface FileSharingRuntime {
  shareFileMessage?: (options: {
    filePath: string;
    fileName: string;
    success: () => void;
    fail: (error: unknown) => void;
  }) => unknown;
}

/** Invoke directly from a user click; never select a recipient or retry automatically. */
export function shareScheduleExport(
  filePath: string,
  fileName: string,
): Promise<'shared' | 'cancelled'> {
  return new Promise((resolve, reject) => {
    const runtime = wx as unknown as FileSharingRuntime;
    if (runtime.shareFileMessage === undefined) {
      reject(new Error('当前微信版本不支持发送文件，请升级微信后重试。'));
      return;
    }
    try {
      runtime.shareFileMessage({
        filePath,
        fileName,
        success: () => resolve('shared'),
        fail: (error) => {
          if (/cancel/i.test(nativeErrorMessage(error))) resolve('cancelled');
          else reject(new Error('文件发送未完成，请重试；若文件已失效，请重新下载。'));
        },
      });
    } catch {
      reject(new Error('文件发送未完成，请重试。'));
    }
  });
}

export async function downloadScheduleExport(
  getAccessToken: () => string | undefined,
  authentication: RuntimeWechatRequestAuthentication | undefined,
  groupId: string,
  exportJobId: string,
  isCurrent: () => boolean = () => true,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let acceptedPath: string | undefined;
    let task: { abort?: () => void } | undefined;
    const timer = setTimeout(() => {
      settleFailure(new ScheduleExportDownloadError('timeout'));
      try {
        task?.abort?.();
      } catch {
        /* Ignore native abort errors after settlement. */
      }
    }, DOWNLOAD_TIMEOUT_MS);

    const settle = (callback: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    const settleFailure = (error: Error): void => {
      settle(() => reject(error));
    };
    const settleSuccess = (result: WxDownloadFileSuccess): void => {
      if (settled) {
        if (result.tempFilePath !== acceptedPath) releaseTemporaryExport(result.tempFilePath);
        return;
      }
      if (!isCurrent()) {
        releaseTemporaryExport(result.tempFilePath);
        settleFailure(new Error('已取消下载。'));
        return;
      }
      if (result.statusCode < 200 || result.statusCode >= 300) {
        releaseTemporaryExport(result.tempFilePath);
        settleFailure(new ScheduleExportDownloadError('http', result.statusCode));
        return;
      }
      if (!result.tempFilePath) {
        settleFailure(new ScheduleExportDownloadError('empty'));
        return;
      }
      acceptedPath = result.tempFilePath;
      settle(() => resolve(result.tempFilePath));
    };

    void (async () => {
      await requireClientCapability('insights');
      if (settled) return;
      let accessToken = getAccessToken();
      if ((accessToken === undefined || accessToken.length === 0) && authentication !== undefined) {
        accessToken = await authentication.awaitAccessToken();
      }
      if (settled) return;
      if (!isCurrent()) throw new Error('已取消下载。');
      if (accessToken === undefined || accessToken.length === 0)
        throw new Error('请先登录后再下载导出文件。');
      try {
        task = (
          wx as unknown as {
            downloadFile: (options: WxDownloadFileOptions) => { abort?: () => void } | undefined;
          }
        ).downloadFile({
          fail: (error) => settleFailure(downloadFailure(error)),
          header: {
            Authorization: `Bearer ${accessToken}`,
            'X-Schedule-Client-Platform': 'miniprogram',
            'X-Schedule-Client-Version': buildInfo.buildVersion,
          },
          success: settleSuccess,
          timeout: DOWNLOAD_TIMEOUT_MS,
          url: `${__MINIPROGRAM_API_BASE_URL__}/groups/${encodeURIComponent(groupId)}/exports/${encodeURIComponent(exportJobId)}/download`,
        } satisfies WxDownloadFileOptions);
      } catch (error) {
        settleFailure(downloadFailure(error));
      }
    })().catch((error: unknown) =>
      settleFailure(error instanceof Error ? error : downloadFailure(error)),
    );
  });
}
