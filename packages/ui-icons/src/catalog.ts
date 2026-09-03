import type { IconDefinition, IconKey, IconNode, MiniAssetEntry } from './types.js';

const path = (
  key: string,
  d: string,
  part?: string,
  options: Omit<IconNode, 'kind' | 'key' | 'd' | 'part'> = {},
) => ({
  kind: 'path' as const,
  key,
  d,
  ...(part === undefined ? {} : { part }),
  ...options,
});

const circle = (
  key: string,
  cx: number,
  cy: number,
  r: number,
  part?: string,
  options: Omit<IconNode, 'kind' | 'key' | 'cx' | 'cy' | 'r' | 'part'> = {},
) => ({
  kind: 'circle' as const,
  key,
  cx,
  cy,
  r,
  ...(part === undefined ? {} : { part }),
  ...options,
});

const rect = (
  key: string,
  x: number,
  y: number,
  width: number,
  height: number,
  rx?: number,
  part?: string,
  options: Omit<IconNode, 'kind' | 'key' | 'x' | 'y' | 'width' | 'height' | 'rx' | 'part'> = {},
) => ({
  kind: 'rect' as const,
  key,
  x,
  y,
  width,
  height,
  ...(rx === undefined ? {} : { rx }),
  ...(part === undefined ? {} : { part }),
  ...options,
});

const group = (key: string, children: readonly IconNode[], part?: string) => ({
  kind: 'group' as const,
  key,
  children,
  ...(part === undefined ? {} : { part }),
});

function local(
  key: IconKey,
  nodes: readonly IconNode[],
  sourceRef = `apps/web/src/features/layout/WorkbenchNavIcon.vue#${key}`,
  lineCap: 'round' | 'square' = 'round',
): IconDefinition {
  return {
    key,
    aliases: [],
    viewBox: '0 0 24 24',
    nodes,
    strokeWidth: 2,
    lineCap,
    lineJoin: 'round',
    sourceRef,
    licenseRef: 'apps/web/docs/third-party-navigation-icon-licenses.md',
    sourceSha: `git:8e6a4a32:${sourceRef}`,
  };
}

function tdesign(
  key: IconKey,
  nodes: readonly IconNode[],
  component: string,
  lineCap: 'butt' | 'round' | 'square' = 'square',
): IconDefinition {
  return {
    key,
    aliases: [],
    viewBox: '0 0 24 24',
    nodes,
    strokeWidth: 2,
    lineCap,
    lineJoin: 'miter',
    sourceRef: `tdesign-icons-vue-next@0.4.7/${component}`,
    licenseRef: 'tdesign-icons-vue-next@0.4.7',
    sourceSha: `package:tdesign-icons-vue-next@0.4.7:${component}`,
  };
}

const calendarBaseNodes: readonly IconNode[] = [
  path('calendar-caps', 'M8 2v4M16 2v4'),
  rect('calendar-body', 3, 4, 18, 18, 2),
  path('calendar-rule', 'M3 10h18'),
];

const calendarBase = local(
  'calendar-base',
  calendarBaseNodes,
  'apps/web/src/features/layout/WorkbenchNavIcon.vue#calendar/base',
);

const calendar = local('calendar', [
  ...calendarBaseNodes,
  path('calendar-check', 'm9 16 2 2 4-4', 'check', { pathLength: 1 }),
]);

const calendarCheck = local(
  'calendar-check',
  [path('calendar-check', 'm9 16 2 2 4-4', 'check', { pathLength: 1 })],
  'apps/web/src/features/layout/WorkbenchNavIcon.vue#calendar/check',
);

const directory = local('directory', [
  path('directory-caps', 'M8 2v2M16 2v2'),
  rect('directory-body', 3, 4, 18, 18, 2),
  group(
    'directory-person',
    [
      circle('directory-head', 12, 11, 3),
      path('directory-shoulders', 'M7 22v-2a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2'),
    ],
    'contact-person',
  ),
]);

const groups = local('groups', [
  path('groups-primary-body', 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2'),
  circle('groups-primary-head', 9, 7, 4),
  group(
    'groups-secondary-person',
    [
      path('groups-secondary-body', 'M22 21v-2a4 4 0 0 0-3-3.87'),
      path('groups-secondary-head', 'M16 3.13a4 4 0 0 1 0 7.75'),
    ],
    'second-person',
  ),
]);

const manual = local('manual', [
  rect('manual-frame', 3, 3, 18, 18, 2),
  path('manual-rules', 'M21 9H3M21 15H3'),
  path('manual-column', 'M15 3v18', 'column'),
]);

const backfill = local('backfill', [
  path('backfill-arrow', 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5'),
  group(
    'backfill-clock',
    [path('backfill-hour', 'M12 12V7'), path('backfill-minute', 'm12 12 4 2')],
    'clock-hands',
  ),
]);

const leave = local('leave', [
  path('leave-caps-rule', 'M16 2v4M8 2v4M3 10h18'),
  path('leave-body', 'M21 15V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8.5'),
  path('leave-minus', 'M16 19h6', 'minus', { pathLength: 1 }),
]);

const leaveMinus = local('leave-minus', [
  path('leave-minus', 'M16 19h6', 'minus', { pathLength: 1 }),
]);

const swapLeft = local(
  'swap-left',
  [path('swap-left-arrow', 'M8 3 4 7l4 4'), path('swap-left-line', 'M4 7h16')],
  'apps/web/src/features/layout/WorkbenchNavIcon.vue#swap',
);

const swapRight = local(
  'swap-right',
  [path('swap-right-arrow', 'm16 21 4-4-4-4'), path('swap-right-line', 'M20 17H4')],
  'apps/web/src/features/layout/WorkbenchNavIcon.vue#swap',
);

const swap = local(
  'swap',
  [
    group('swap-left-part', swapLeft.nodes, 'arrow-left'),
    group('swap-right-part', swapRight.nodes, 'arrow-right'),
  ],
  'apps/web/src/features/layout/WorkbenchNavIcon.vue#swap',
);

const duty = local('duty', [
  group('duty-mark', [path('duty-mark', 'M12 3v14M5 10h14M5 21h14')], 'plus-minus'),
]);

const events = local('events', [
  path('events-lines', 'M8 5h13M8 12h13M8 19h13'),
  group('events-dots', [path('events-dots', 'M3 5h.01M3 12h.01M3 19h.01')], 'event-dots'),
]);

const notifications = local('notifications', [
  group(
    'notifications-bell',
    [
      path('notifications-body', 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9'),
      path('notifications-clapper', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'),
    ],
    'bell',
  ),
]);

const statistics = local('statistics', [
  path('statistics-axis', 'M3 3v16a2 2 0 0 0 2 2h16'),
  path('statistics-trend', 'm7 13 3-3 4 4 5-5', 'trend', { pathLength: 1 }),
]);

const members = local('members', [
  rect('members-frame', 2, 5, 20, 14, 2),
  group(
    'members-content',
    [
      circle('members-head', 9, 11, 2),
      path('members-body', 'M6.17 15a3 3 0 0 1 5.66 0M16 10h2M16 14h2'),
    ],
    'member-card-content',
  ),
]);

const profile = local(
  'profile',
  [
    path('profile-body', 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2'),
    circle('profile-head', 12, 7, 4, 'portrait'),
  ],
  'apps/web/src/features/layout/WorkbenchNavIcon.vue#profile',
);

const config = local('config', [
  group(
    'config-gear',
    [
      path(
        'config-teeth',
        'M9.67 4.14a2.34 2.34 0 0 1 4.66 0 2.34 2.34 0 0 0 3.32 1.91 2.34 2.34 0 0 1 2.33 4.03 2.34 2.34 0 0 0 0 3.84 2.34 2.34 0 0 1-2.33 4.03 2.34 2.34 0 0 0-3.32 1.91 2.34 2.34 0 0 1-4.66 0 2.34 2.34 0 0 0-3.32-1.91 2.34 2.34 0 0 1-2.33-4.03 2.34 2.34 0 0 0 0-3.84 2.34 2.34 0 0 1 2.33-4.03 2.34 2.34 0 0 0 3.32-1.91',
      ),
      circle('config-hole', 12, 12, 3),
    ],
    'gear',
  ),
]);

const logout = local('logout', [
  path('logout-frame', 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4'),
  group(
    'logout-arrow',
    [path('logout-line', 'M21 12H9'), path('logout-chevron', 'm16 17 5-5-5-5')],
    'logout-arrow',
  ),
]);

const more = local('more', [
  circle('more-one', 5, 12, 1, 'dot-one'),
  circle('more-two', 12, 12, 1, 'dot-two'),
  circle('more-three', 19, 12, 1, 'dot-three'),
]);

const bell = local(
  'bell',
  [
    group(
      'bell-body',
      [
        path('bell-shape', 'M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z'),
        path('bell-clapper', 'M10 21h4'),
      ],
      'bell',
    ),
  ],
  'apps/web/src/components/LucideMinimalActionIcon.vue#bell',
);

const user = tdesign(
  'user',
  [
    group(
      'user-mark',
      [
        path(
          'user-head',
          'M16.5 7.5C16.5 9.98528 14.4853 12 12 12C9.51472 12 7.5 9.98528 7.5 7.5C7.5 5.01472 9.51472 3 12 3C14.4853 3 16.5 5.01472 16.5 7.5Z',
        ),
        path(
          'user-body',
          'M20 21V19C20 16.7909 18.2091 15 16 15H8C5.79086 15 4 16.7909 4 19V21H20',
        ),
      ],
      'user',
    ),
  ],
  'user',
);

const exportIcon = tdesign(
  'export',
  [
    path('export-frame', 'M10 3H3V21H21V15', 'frame'),
    path(
      'export-route',
      'M10.5 14.75L10.5 11.5C10.5 8.73857 12.7386 6.5 15.5 6.5L21 6.49999',
      'arrow',
    ),
    path('export-arrow', 'M19 10L22.5 6.49999L19 3', 'arrow'),
  ],
  'export',
);

const filterTopNodes: readonly IconNode[] = [path('filter-top', 'M4 6h16', 'filter-top')];
const filterMiddleNodes: readonly IconNode[] = [path('filter-middle', 'M7 12h10', 'filter-middle')];
const filterBottomNodes: readonly IconNode[] = [path('filter-bottom', 'M10 18h4', 'filter-bottom')];

const filter = local(
  'filter',
  [...filterTopNodes, ...filterMiddleNodes, ...filterBottomNodes],
  'apps/web/src/components/LucideMinimalActionIcon.vue#filter',
);
const filterTop = local(
  'filter-top',
  filterTopNodes,
  'apps/web/src/components/LucideMinimalActionIcon.vue#filter/top',
);
const filterMiddle = local(
  'filter-middle',
  filterMiddleNodes,
  'apps/web/src/components/LucideMinimalActionIcon.vue#filter/middle',
);
const filterBottom = local(
  'filter-bottom',
  filterBottomNodes,
  'apps/web/src/components/LucideMinimalActionIcon.vue#filter/bottom',
);

const filterFunnel = tdesign(
  'filter-funnel',
  [
    path('filter-funnel', 'M19.5 4H4.5L10.5 12.5V20H13.5V12.5L19.5 4Z', undefined, {
      fillRule: 'evenodd',
      clipRule: 'evenodd',
    }),
  ],
  'filter',
);

const locate = local(
  'locate',
  [
    group(
      'locate-rotor',
      [
        path('locate-crosshair', 'M12 2v4M12 18v4M2 12h4M18 12h4'),
        circle('locate-ring', 12, 12, 6),
      ],
      'rotor',
    ),
    circle('locate-center', 12, 12, 1.5, undefined, { fill: 'currentColor', stroke: 'none' }),
  ],
  'apps/web/src/components/LucideMinimalActionIcon.vue#locate',
);

const department = local(
  'department',
  [
    group(
      'department-rotor',
      [
        rect('department-one', 4, 4, 6, 6, 1.5),
        rect('department-two', 14, 4, 6, 6, 1.5),
        rect('department-three', 4, 14, 6, 6, 1.5),
        rect('department-four', 14, 14, 6, 6, 1.5),
      ],
      'rotor',
    ),
  ],
  'apps/web/src/components/LucideMinimalActionIcon.vue#department',
);

const peoplePrimaryNodes: readonly IconNode[] = [
  path('people-primary-body', 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2'),
  circle('people-primary-head', 9, 7, 4),
];
const peopleSecondaryNodes: readonly IconNode[] = [
  path('people-secondary-body', 'M22 21v-2a4 4 0 0 0-3-3.87'),
  path('people-secondary-head', 'M16 3.13a4 4 0 0 1 0 7.75'),
];
const people = local(
  'people',
  [
    group('people-primary', peoplePrimaryNodes, 'primary'),
    group('people-secondary', peopleSecondaryNodes, 'secondary'),
  ],
  'apps/web/src/components/LucideMinimalActionIcon.vue#people',
);
const peoplePrimary = local(
  'people-primary',
  peoplePrimaryNodes,
  'apps/web/src/components/LucideMinimalActionIcon.vue#people/primary',
);
const peopleSecondary = local(
  'people-secondary',
  peopleSecondaryNodes,
  'apps/web/src/components/LucideMinimalActionIcon.vue#people/secondary',
);

const phone = tdesign(
  'phone',
  [
    path(
      'phone-body',
      'M21 22C17.2007 22 13.6618 20.8848 10.6929 18.964C8.43077 17.5005 6.49953 15.5692 5.03601 13.3071C3.11515 10.3382 2 6.79932 2 3H8.77778L9.97148 8.37167L7.94713 10.396C9.28619 12.7542 11.2458 14.7138 13.604 16.0529L15.6283 14.0285L21 15.2222V22Z',
    ),
  ],
  'call',
  'butt',
);

const close = tdesign(
  'close',
  [
    path(
      'close-mark',
      'M16.9503 7.05029L12.0005 12M12.0005 12L7.05078 16.9498M12.0005 12L16.9503 16.9498M12.0005 12L7.05078 7.05029',
    ),
  ],
  'close',
);
const search = tdesign(
  'search',
  [
    path(
      'search-ring',
      'M15.8033 15.8033C12.8744 18.7322 8.12563 18.7322 5.1967 15.8033C2.26777 12.8744 2.26777 8.12563 5.1967 5.1967C8.12563 2.26777 12.8744 2.26777 15.8033 5.1967Z',
    ),
    path('search-handle', 'M15.8027 15.8037L21.106 21.107'),
  ],
  'search',
);
const filterClear = tdesign(
  'filter-clear',
  [
    path('filter-clear-funnel', 'M19.5 4H4.5L10.5 12.5V20H13.5V12.5L19.5 4Z', undefined, {
      fillRule: 'evenodd',
      clipRule: 'evenodd',
    }),
    path(
      'filter-clear-mark',
      'M22.1215 14.8789L20.0002 17.0002M20.0002 17.0002L17.8789 19.1215M20.0002 17.0002L17.8789 14.8789M20.0002 17.0002L22.1215 19.1215',
    ),
  ],
  'filter-clear',
);
const history = tdesign(
  'history',
  [
    path(
      'history',
      'M2.552 13C3.0517 17.7767 7.09104 21.5 12 21.5C17.2467 21.5 21.5 17.2467 21.5 12C21.5 6.7533 17.2467 2.5 12 2.5C10.3719 2.5 8.8394 2.90957 7.5 3.63131C5.69871 4.60193 4.24661 6.13714 3.38065 8M12 7V12L14.5 14.5M2.5 3.5V8.5H7.5',
    ),
  ],
  'history',
);
const star = tdesign(
  'star',
  [
    path(
      'star',
      'M12.0001 3.67603L14.1867 9.96648L20.8449 10.1022L15.538 14.1256L17.4665 20.4999L12.0001 16.696L6.5337 20.4999L8.46217 14.1256L3.15527 10.1022L9.81354 9.96648L12.0001 3.67603Z',
    ),
  ],
  'star',
);
const starFilled = tdesign(
  'star-filled',
  [
    path(
      'star-filled',
      'M12.0012 0.63031L14.9039 8.98087L23.7427 9.16099L16.6978 14.502L19.2579 22.9639L12.0012 17.9143L4.74461 22.9639L7.30465 14.502L0.259766 9.16099L9.09859 8.98087L12.0012 0.63031Z',
      undefined,
      { fill: 'currentColor', stroke: 'none' },
    ),
  ],
  'star-filled',
  'square',
);
const chevronLeft = tdesign(
  'chevron-left',
  [path('chevron-left', 'M14.5 17.5L9 12L14.5 6.5')],
  'chevron-left',
);
const chevronRight = tdesign(
  'chevron-right',
  [path('chevron-right', 'M9.5 17.5L15 12L9.5 6.5')],
  'chevron-right',
);
const lock = tdesign(
  'lock',
  [
    path('lock-fill', 'M4.49951 10H19.4995V21H4.49951V10', undefined, { fill: 'none' }),
    group(
      'lock-strokes',
      [
        path('lock-body', 'M4.49951 11H19.4995V21H4.49951V11'),
        path(
          'lock-shackle',
          'M6.99951 7C6.99951 4.23858 9.23809 2 11.9995 2C14.7609 2 16.9995 4.23858 16.9995 7V11H6.99951V7',
        ),
      ],
      'lock',
    ),
    path('lock-mark', 'M9.99951 16H13.9995'),
  ],
  'lock-on',
);
const download = tdesign(
  'download',
  [
    path('download-arrow', 'M16.5 10.5L12 15L7.5 10.5M12 13.75V4'),
    path('download-frame', 'M20.5 15V20H3.5V15'),
  ],
  'download',
);
const infoCircle = tdesign(
  'info-circle',
  [
    path(
      'info-circle',
      'M2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12Z',
    ),
    path('info-mark', 'M12 16.5L12 11M12 7.5L11.9961 7.5L11.9961 7.49609L12 7.49609L12 7.5'),
  ],
  'info-circle',
);
const errorCircle = tdesign(
  'error-circle',
  [
    path(
      'error-circle',
      'M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z',
    ),
    path('error-mark', 'M12 7.5V13M12 16.5H12.0039V16.5039H12V16.5Z'),
  ],
  'error-circle',
);
const wifiOff = tdesign(
  'wifi-off',
  [
    path(
      'wifi-arcs',
      'M6.6958 13.6958C7.89392 12.4977 9.39655 11.7897 10.9546 11.5717M2.09961 9.09982C3.19772 8.00171 4.43287 7.12416 5.75 6.46716M10.125 5.12533C14.3038 4.56385 18.6876 5.88892 21.8992 9.10049M11.293 18.2929C11.6835 17.9024 12.3167 17.9024 12.7072 18.2929L12.0001 19L11.293 18.2929Z',
    ),
    path('wifi-slash', 'M3 3L21 21'),
  ],
  'wifi-off',
);

export const iconCatalog = {
  backfill,
  bell,
  calendar,
  'calendar-base': calendarBase,
  'calendar-check': calendarCheck,
  'chevron-left': chevronLeft,
  'chevron-right': chevronRight,
  close,
  config,
  department,
  directory,
  duty,
  download,
  'error-circle': errorCircle,
  events,
  export: exportIcon,
  filter,
  'filter-bottom': filterBottom,
  'filter-clear': filterClear,
  'filter-funnel': filterFunnel,
  'filter-middle': filterMiddle,
  'filter-top': filterTop,
  groups,
  history,
  'info-circle': infoCircle,
  leave,
  'leave-minus': leaveMinus,
  locate,
  lock,
  logout,
  manual,
  members,
  more,
  'more-primary': local(
    'more-primary',
    [circle('more-primary', 5, 12, 1)],
    'apps/web/src/features/layout/WorkbenchNavIcon.vue#more',
  ),
  'more-secondary': local(
    'more-secondary',
    [circle('more-secondary', 12, 12, 1)],
    'apps/web/src/features/layout/WorkbenchNavIcon.vue#more',
  ),
  'more-tertiary': local(
    'more-tertiary',
    [circle('more-tertiary', 19, 12, 1)],
    'apps/web/src/features/layout/WorkbenchNavIcon.vue#more',
  ),
  notifications,
  people,
  'people-primary': peoplePrimary,
  'people-secondary': peopleSecondary,
  phone,
  profile,
  search,
  star,
  'star-filled': starFilled,
  statistics,
  swap,
  'swap-left': swapLeft,
  'swap-right': swapRight,
  user,
  'wifi-off': wifiOff,
} as const satisfies Readonly<Record<IconKey, IconDefinition>>;

export const miniAssetEntries: readonly MiniAssetEntry[] = [
  { fileKey: 'backfill', sourceKey: 'backfill', colorRole: 'secondary' },
  { fileKey: 'bell', sourceKey: 'bell', colorRole: 'primary' },
  { fileKey: 'calendar', sourceKey: 'calendar-base', colorRole: 'primary' },
  { fileKey: 'calendar-check', sourceKey: 'calendar-check', colorRole: 'primary' },
  { fileKey: 'chevron-left', sourceKey: 'chevron-left', colorRole: 'primary' },
  { fileKey: 'chevron-right', sourceKey: 'chevron-right', colorRole: 'primary' },
  { fileKey: 'chevron-right-muted', sourceKey: 'chevron-right', colorRole: 'muted' },
  { fileKey: 'close', sourceKey: 'close', colorRole: 'secondary' },
  { fileKey: 'config', sourceKey: 'config', colorRole: 'secondary' },
  { fileKey: 'department', sourceKey: 'department', colorRole: 'primary' },
  { fileKey: 'department-muted', sourceKey: 'department', colorRole: 'muted' },
  { fileKey: 'directory', sourceKey: 'directory', colorRole: 'primary' },
  { fileKey: 'duty', sourceKey: 'duty', colorRole: 'secondary' },
  { fileKey: 'events', sourceKey: 'events', colorRole: 'secondary' },
  { fileKey: 'export', sourceKey: 'export', colorRole: 'secondary' },
  { fileKey: 'filter-top', sourceKey: 'filter-top', colorRole: 'primary' },
  { fileKey: 'filter-middle', sourceKey: 'filter-middle', colorRole: 'primary' },
  { fileKey: 'filter-bottom', sourceKey: 'filter-bottom', colorRole: 'primary' },
  { fileKey: 'filter-clear', sourceKey: 'filter-clear', colorRole: 'primary' },
  { fileKey: 'filter-funnel', sourceKey: 'filter-funnel', colorRole: 'primary' },
  { fileKey: 'groups', sourceKey: 'groups', colorRole: 'secondary' },
  { fileKey: 'history', sourceKey: 'history', colorRole: 'secondary' },
  { fileKey: 'info-circle', sourceKey: 'info-circle', colorRole: 'secondary' },
  { fileKey: 'leave', sourceKey: 'leave', colorRole: 'secondary' },
  { fileKey: 'locate', sourceKey: 'locate', colorRole: 'primary' },
  { fileKey: 'lock', sourceKey: 'lock', colorRole: 'primary' },
  { fileKey: 'manual', sourceKey: 'manual', colorRole: 'secondary' },
  { fileKey: 'more-primary', sourceKey: 'more-primary', colorRole: 'secondary' },
  { fileKey: 'more-secondary', sourceKey: 'more-secondary', colorRole: 'secondary' },
  { fileKey: 'more-tertiary', sourceKey: 'more-tertiary', colorRole: 'secondary' },
  { fileKey: 'notifications', sourceKey: 'notifications', colorRole: 'secondary' },
  { fileKey: 'people-primary', sourceKey: 'people-primary', colorRole: 'primary' },
  { fileKey: 'people-primary-muted', sourceKey: 'people-primary', colorRole: 'muted' },
  { fileKey: 'people-secondary', sourceKey: 'people-secondary', colorRole: 'primary' },
  { fileKey: 'people-secondary-muted', sourceKey: 'people-secondary', colorRole: 'muted' },
  { fileKey: 'phone', sourceKey: 'phone', colorRole: 'primary' },
  { fileKey: 'phone-success', sourceKey: 'phone', colorRole: 'success' },
  { fileKey: 'profile', sourceKey: 'profile', colorRole: 'primary' },
  { fileKey: 'search', sourceKey: 'search', colorRole: 'muted' },
  { fileKey: 'star', sourceKey: 'star', colorRole: 'muted' },
  { fileKey: 'star-filled', sourceKey: 'star-filled', colorRole: 'favorite' },
  { fileKey: 'swap-left', sourceKey: 'swap-left', colorRole: 'secondary' },
  { fileKey: 'swap-right', sourceKey: 'swap-right', colorRole: 'secondary' },
  { fileKey: 'user', sourceKey: 'user', colorRole: 'primary' },
];
