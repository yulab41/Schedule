import { describe, expect, it } from 'vitest';

import { getAppStatePresentation } from './app-state.js';

describe('application state presentation', () => {
  it('turns an empty guest entry into a directional instruction', () => {
    expect(getAppStatePresentation('guest-link-missing')).toEqual({
      description: '请扫描群主或管理员分享的访客码，再从新链接进入。',
      eyebrow: '访客排班',
      title: '等待有效的访客链接',
      tone: 'empty',
    });
  });

  it('states that offline mode is read-only and never queues writes', () => {
    const state = getAppStatePresentation('offline');
    expect(state.title).toBe('当前使用缓存内容');
    expect(state.description).toContain('提交已暂停');
    expect(state.description).toContain('恢复网络');
    expect(state.tone).toBe('offline');
  });
});
