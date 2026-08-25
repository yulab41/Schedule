import {
  requireClientCapability,
} from '../app/client-capability-store.js';
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

export async function downloadScheduleExport(
  getAccessToken: () => string | undefined,
  authentication: RuntimeWechatRequestAuthentication | undefined,
  groupId: string,
  exportJobId: string,
): Promise<string> {
  await requireClientCapability('insights');
  let accessToken = getAccessToken();
  if ((accessToken === undefined || accessToken.length === 0) && authentication !== undefined) {
    accessToken = await authentication.awaitAccessToken();
  }
  if (accessToken === undefined || accessToken.length === 0) {
    throw new Error('请先登录后再下载导出文件。');
  }
  return new Promise((resolve, reject) => {
    (wx as unknown as { downloadFile: (options: WxDownloadFileOptions) => unknown }).downloadFile({
      fail: () => reject(new Error('导出文件下载失败，请稍后重试。')),
      header: {
        Authorization: `Bearer ${accessToken}`,
        'X-Schedule-Client-Platform': 'miniprogram',
        'X-Schedule-Client-Version': buildInfo.buildVersion,
      },
      success: (result) => {
        if (result.statusCode < 200 || result.statusCode >= 300 || result.tempFilePath.length === 0) {
          reject(new Error('导出文件暂时不可用，请稍后重试。'));
          return;
        }
        resolve(result.tempFilePath);
      },
      timeout: 30_000,
      url: `${__MINIPROGRAM_API_BASE_URL__}/groups/${encodeURIComponent(groupId)}/exports/${encodeURIComponent(exportJobId)}/download`,
    } satisfies WxDownloadFileOptions);
  });
}
