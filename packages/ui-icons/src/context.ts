import type { IconColorRole, IconContextKey } from './types.js';

export type { IconContextKey } from './types.js';

export interface IconContextSpec {
  readonly activeColorRole: IconColorRole;
  readonly inactiveColorRole: IconColorRole;
  readonly key: IconContextKey;
  readonly sizePx: number;
  readonly strokeWidth: number;
}

export const iconContextSpecs = {
  'mobile-bottom-navigation': {
    key: 'mobile-bottom-navigation',
    sizePx: 23,
    strokeWidth: 2,
    activeColorRole: 'primary',
    inactiveColorRole: 'secondary',
  },
  'desktop-navigation': {
    key: 'desktop-navigation',
    sizePx: 20,
    strokeWidth: 2,
    activeColorRole: 'primary',
    inactiveColorRole: 'secondary',
  },
  'top-profile': {
    key: 'top-profile',
    sizePx: 20,
    strokeWidth: 2,
    activeColorRole: 'primary',
    inactiveColorRole: 'primary',
  },
  'top-bell': {
    key: 'top-bell',
    sizePx: 21.6,
    strokeWidth: 1.8,
    activeColorRole: 'primary',
    inactiveColorRole: 'primary',
  },
  'directory-mode': {
    key: 'directory-mode',
    sizePx: 18,
    strokeWidth: 1.8,
    activeColorRole: 'primary',
    inactiveColorRole: 'directoryModeInactive',
  },
  'directory-favorite': {
    key: 'directory-favorite',
    sizePx: 21,
    strokeWidth: 2,
    activeColorRole: 'favorite',
    inactiveColorRole: 'muted',
  },
  'directory-phone': {
    key: 'directory-phone',
    sizePx: 17,
    strokeWidth: 2,
    activeColorRole: 'primary',
    inactiveColorRole: 'primary',
  },
  'calendar-filter': {
    key: 'calendar-filter',
    sizePx: 20,
    strokeWidth: 1.8,
    activeColorRole: 'primary',
    inactiveColorRole: 'primary',
  },
  'calendar-locate': {
    key: 'calendar-locate',
    sizePx: 16,
    strokeWidth: 2,
    activeColorRole: 'primary',
    inactiveColorRole: 'primary',
  },
  'more-row': {
    key: 'more-row',
    sizePx: 20,
    strokeWidth: 2,
    activeColorRole: 'primary',
    inactiveColorRole: 'secondary',
  },
} as const satisfies Readonly<Record<IconContextKey, IconContextSpec>>;
