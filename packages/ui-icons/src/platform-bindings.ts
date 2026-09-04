import type { IconContextKey } from './context.js';
import { iconMotionSpecs } from './motion.js';

export type IconMotionSpecKey = keyof typeof iconMotionSpecs;

export interface IconContextBinding {
  readonly contextKey: IconContextKey;
  readonly mode: 'action-variables' | 'box' | 'svg-box';
  readonly selector: string;
}

export interface IconMotionBinding {
  readonly capability?: 'omit-stroke-dashoffset';
  readonly partKey: string;
  readonly selector: string;
  readonly specKey: IconMotionSpecKey;
  readonly transformBox?: 'view-box';
  readonly transformOrigin?: string;
}

const motion = (
  selector: string,
  specKey: IconMotionSpecKey,
  partKey: string,
  options: Omit<IconMotionBinding, 'partKey' | 'selector' | 'specKey'> = {},
): IconMotionBinding => ({ selector, specKey, partKey, ...options });

export const webContextBindings: readonly IconContextBinding[] = [
  { selector: '.static-motion-icon', contextKey: 'static-action', mode: 'action-variables' },
  {
    selector: '.workbench-sidebar .workbench-nav-icon',
    contextKey: 'desktop-navigation',
    mode: 'svg-box',
  },
  {
    selector: '.workbench-bottom-nav .workbench-nav-icon',
    contextKey: 'mobile-bottom-navigation',
    mode: 'svg-box',
  },
  {
    selector: '.more-nav-item .workbench-nav-icon',
    contextKey: 'more-row',
    mode: 'svg-box',
  },
  { selector: '.notification-icon', contextKey: 'top-bell', mode: 'action-variables' },
  { selector: '.top-action-motion-icon', contextKey: 'top-profile', mode: 'action-variables' },
  { selector: '.directory-mode-icon', contextKey: 'directory-mode', mode: 'action-variables' },
  { selector: '.favorite-action svg', contextKey: 'directory-favorite', mode: 'svg-box' },
  {
    selector: '.directory-dial-action .phone-motion-icon',
    contextKey: 'directory-phone',
    mode: 'action-variables',
  },
  {
    selector: '.duty-phone-button .phone-motion-icon',
    contextKey: 'duty-phone',
    mode: 'action-variables',
  },
  {
    selector: '.staff-name-button .phone-motion-icon, .phone-split-actions .phone-motion-icon',
    contextKey: 'calendar-phone-small',
    mode: 'action-variables',
  },
  { selector: '.filter-icon', contextKey: 'calendar-filter', mode: 'action-variables' },
  { selector: '.locator-motion-icon', contextKey: 'calendar-locate', mode: 'action-variables' },
];

export const miniProgramContextBindings: readonly IconContextBinding[] = [
  { selector: '.nav-icon', contextKey: 'mobile-bottom-navigation', mode: 'box' },
  { selector: '.top-icon.bell-icon', contextKey: 'top-bell', mode: 'box' },
  { selector: '.top-icon.profile-icon', contextKey: 'top-profile', mode: 'box' },
  { selector: '.mode-icon, .mode-icon-image', contextKey: 'directory-mode', mode: 'box' },
  { selector: '.favorite-icon', contextKey: 'directory-favorite', mode: 'box' },
  { selector: '.phone-icon', contextKey: 'directory-phone', mode: 'box' },
  { selector: '.filter-icon, .filter-icon-bar', contextKey: 'calendar-filter', mode: 'box' },
  { selector: '.locate-crosshair', contextKey: 'calendar-locate', mode: 'box' },
  { selector: '.more-item > image:first-child', contextKey: 'more-row', mode: 'box' },
  { selector: '.detail-phone-action image', contextKey: 'calendar-phone-small', mode: 'box' },
];

export const webMotionBindings: readonly IconMotionBinding[] = [
  motion(".icon-bell .is-animating [data-part='bell']", 'bell', 'bell', {
    transformBox: 'view-box',
    transformOrigin: '12px 3px',
  }),
  motion(".icon-profile .is-animating [data-part='user']", 'profile', 'portrait', {
    transformBox: 'view-box',
    transformOrigin: 'center',
  }),
  motion(".icon-export .is-animating [data-part='frame']", 'export', 'frame', {
    transformBox: 'view-box',
    transformOrigin: 'center',
  }),
  motion(".icon-export .is-animating [data-part='arrow']", 'export', 'arrow', {
    transformBox: 'view-box',
    transformOrigin: 'center',
  }),
  motion(".icon-filter .is-animating [data-part='filter-top']", 'filter', 'filter-top'),
  motion(".icon-filter .is-animating [data-part='filter-middle']", 'filter', 'filter-middle'),
  motion(".icon-filter .is-animating [data-part='filter-bottom']", 'filter', 'filter-bottom'),
  motion(".icon-locate .is-animating [data-part='rotor']", 'locate', 'rotor', {
    transformBox: 'view-box',
    transformOrigin: '12px 12px',
  }),
  motion(".icon-department .is-animating [data-part='rotor']", 'department', 'rotor', {
    transformBox: 'view-box',
    transformOrigin: '12px 12px',
  }),
  motion(".icon-people .is-animating [data-part='primary']", 'people', 'primary'),
  motion(".icon-people .is-animating [data-part='secondary']", 'people', 'secondary'),
  motion(".icon-phone .is-animating [data-part='phone-body']", 'phone', 'phone-body', {
    transformBox: 'view-box',
    transformOrigin: 'center',
  }),
  motion(".is-looping.icon-calendar [data-part='check']", 'navigation', 'check'),
  motion(".is-looping.icon-leave [data-part='minus']", 'navigation', 'check'),
  motion(".is-looping.icon-statistics [data-part='trend']", 'navigation', 'check'),
  motion(".is-looping.icon-directory [data-part='contact-person']", 'navigation-enter', 'actor'),
  motion(".is-looping.icon-groups [data-part='second-person']", 'navigation-enter', 'actor'),
  motion(".is-looping.icon-members [data-part='member-card-content']", 'navigation-enter', 'actor'),
  motion(".is-looping.icon-manual [data-part='column']", 'navigation-column', 'column'),
  motion(
    ".is-looping.icon-backfill [data-part='clock-hands']",
    'navigation-rewind',
    'clock-hands',
    {
      transformBox: 'view-box',
      transformOrigin: '12px 12px',
    },
  ),
  motion(".is-looping.icon-swap [data-part='arrow-left']", 'navigation-swap', 'arrow-left'),
  motion(".is-looping.icon-swap [data-part='arrow-right']", 'navigation-swap', 'arrow-right'),
  motion(".is-looping.icon-duty [data-part='plus-minus']", 'navigation-duty', 'plus-minus'),
  motion(".is-looping.icon-events [data-part='event-dots']", 'navigation-events', 'event-dots'),
  motion(".is-looping.icon-notifications [data-part='bell']", 'navigation-bell', 'bell', {
    transformBox: 'view-box',
    transformOrigin: '12px 3px',
  }),
  motion(".is-looping.icon-profile [data-part='portrait']", 'navigation-profile', 'portrait'),
  motion(".is-looping.icon-config [data-part='gear']", 'navigation-gear', 'gear', {
    transformBox: 'view-box',
    transformOrigin: '12px 12px',
  }),
  motion(".is-looping.icon-more [data-part='dot-one']", 'more-stagger', 'dot-one'),
  motion(".is-looping.icon-more [data-part='dot-two']", 'more-stagger', 'dot-two'),
  motion(".is-looping.icon-more [data-part='dot-three']", 'more-stagger', 'dot-three'),
  motion(".is-looping.icon-logout [data-part='logout-arrow']", 'navigation-logout', 'logout-arrow'),
];

export const miniProgramMotionBindings: readonly IconMotionBinding[] = [
  motion('.filter-icon.is-animating .filter-icon-bar-top', 'filter', 'filter-top'),
  motion('.filter-icon.is-animating .filter-icon-bar-middle', 'filter', 'filter-middle'),
  motion('.filter-icon.is-animating .filter-icon-bar-bottom', 'filter', 'filter-bottom'),
  motion('.locate-crosshair.is-animating', 'locate', 'rotor', { transformOrigin: 'center' }),
  motion('.workflow-picker-date-locate-icon.is-animating', 'locate', 'rotor', {
    transformOrigin: 'center',
  }),
  motion('.department-icon.is-animating .mode-icon-image', 'department', 'rotor', {
    transformOrigin: 'center',
  }),
  motion('.people-icon.is-animating .mode-icon-image-primary', 'people', 'primary'),
  motion('.people-icon.is-animating .mode-icon-image-secondary', 'people', 'secondary'),
  motion('.phone-icon.is-animating', 'phone', 'phone-body', { transformOrigin: 'center' }),
  motion('.bell-icon.is-animating', 'bell', 'bell', { transformOrigin: '12px 3px' }),
  motion('.profile-icon.is-animating', 'profile', 'portrait', { transformOrigin: 'center' }),
  motion('.nav-calendar.is-looping .nav-icon-actor', 'navigation', 'check', {
    capability: 'omit-stroke-dashoffset',
  }),
  motion('.nav-directory.is-looping .nav-icon-actor', 'navigation-enter', 'actor'),
  motion('.nav-swap.is-looping .nav-icon-actor', 'navigation-swap', 'arrow-left'),
  motion('.nav-swap.is-looping .nav-icon-actor-secondary', 'navigation-swap', 'arrow-right'),
  motion('.nav-profile.is-looping .nav-icon-actor', 'navigation-profile', 'portrait'),
  motion('.nav-more.is-looping .nav-icon-actor', 'more-stagger', 'dot-one'),
  motion('.nav-more.is-looping .nav-icon-actor-secondary', 'more-stagger', 'dot-two'),
  motion('.nav-more.is-looping .nav-icon-actor-tertiary', 'more-stagger', 'dot-three'),
  motion('.calendar-navigation .chevron.is-right.is-animating', 'period-chevron', 'right'),
  motion('.list-calendar-heading .chevron.is-right.is-animating', 'period-chevron', 'right'),
  motion('.calendar-navigation .chevron.is-left.is-animating', 'period-chevron', 'left'),
  motion('.list-calendar-heading .chevron.is-left.is-animating', 'period-chevron', 'left'),
  motion('.month-toolbar .chevron.is-right.is-animating', 'calendar-chevron', 'right'),
  motion('.month-toolbar .chevron.is-left.is-animating', 'calendar-chevron', 'left'),
];

export const webReducedMotionSelectors = [
  '.workbench-nav-icon:not(.force-motion) [data-part]',
  '.static-motion-icon:not(.preview-motion) .is-animating [data-part]',
] as const;

export const miniProgramReducedMotionSelectors = [
  '.filter-icon.is-animating image',
  '.locate-crosshair.is-animating',
  '.workflow-picker-date-locate-icon.is-animating',
  '.department-icon.is-animating .mode-icon-image',
  '.people-icon.is-animating .mode-icon-image',
  '.phone-icon.is-animating',
  '.bell-icon.is-animating',
  '.profile-icon.is-animating',
  '.nav-icon image',
  '.chevron.is-animating',
] as const;
