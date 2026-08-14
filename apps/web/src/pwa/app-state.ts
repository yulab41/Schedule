import { offlineSubmitMessage } from './offline-guard.js';

export type AppStateId = 'guest-link-invalid' | 'guest-link-missing' | 'offline';
export type AppStateTone = 'empty' | 'error' | 'offline';

export interface AppStatePresentation {
  readonly description: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly tone: AppStateTone;
}

const appStatePresentations: Readonly<Record<AppStateId, AppStatePresentation>> = {
  'guest-link-invalid': {
    description: '请向群主或管理员获取新的访客码，再从新链接进入。',
    eyebrow: '访客排班',
    title: '无法打开这份访客排班',
    tone: 'error',
  },
  'guest-link-missing': {
    description: '请扫描群主或管理员分享的访客码，再从新链接进入。',
    eyebrow: '访客排班',
    title: '等待有效的访客链接',
    tone: 'empty',
  },
  offline: {
    description: offlineSubmitMessage,
    eyebrow: '离线只读',
    title: '当前使用缓存内容',
    tone: 'offline',
  },
};

export function getAppStatePresentation(state: AppStateId): AppStatePresentation {
  return appStatePresentations[state];
}
