import { colorTokens } from '@schedule/ui-tokens';

export const webAppManifest = {
  background_color: colorTokens.background,
  description: '医护值班排班、请假、换班、加扣班与统计',
  display: 'standalone',
  icons: [
    {
      purpose: 'any',
      sizes: '192x192',
      src: '/icons/icon-192.png',
      type: 'image/png',
    },
    {
      purpose: 'any',
      sizes: '512x512',
      src: '/icons/icon-512.png',
      type: 'image/png',
    },
    {
      purpose: 'maskable',
      sizes: '512x512',
      src: '/icons/maskable-512.png',
      type: 'image/png',
    },
  ],
  lang: 'zh-CN',
  name: '医护排班系统',
  orientation: 'portrait',
  scope: '/',
  short_name: '医护排班',
  start_url: '/',
  theme_color: colorTokens.primary,
} as const;
