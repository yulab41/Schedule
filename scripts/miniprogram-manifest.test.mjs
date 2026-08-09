import { describe, expect, it } from 'vitest';

import { listRegisteredPages } from './miniprogram-manifest.mjs';

describe('miniprogram manifest routes', () => {
  it('returns main-package routes followed by normalized subpackage routes', () => {
    expect(
      listRegisteredPages({
        pages: ['pages/workbench/index', 'pages/calendar/index'],
        subPackages: [
          { pages: ['login/index', '/profile/index/'], root: 'pages/auth/' },
          { pages: ['manual/index'], root: '/pages/schedule' },
        ],
      }),
    ).toEqual([
      'pages/workbench/index',
      'pages/calendar/index',
      'pages/auth/login/index',
      'pages/auth/profile/index',
      'pages/schedule/manual/index',
    ]);
  });

  it('rejects duplicate normalized routes instead of silently skipping coverage', () => {
    expect(() =>
      listRegisteredPages({
        pages: ['pages/auth/login/index'],
        subPackages: [{ pages: ['login/index'], root: 'pages/auth' }],
      }),
    ).toThrow('Duplicate miniprogram route: pages/auth/login/index');
  });

  it('rejects a malformed pages or subPackages shape', () => {
    expect(() => listRegisteredPages({ pages: 'pages/workbench/index' })).toThrow(
      'app.json pages must be an array of non-empty strings',
    );
    expect(() =>
      listRegisteredPages({ pages: ['pages/workbench/index'], subPackages: [{}] }),
    ).toThrow('subPackages[0].root must be a non-empty string');
  });
});
