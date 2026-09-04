import { iconCatalog, miniAssetEntries } from './catalog.js';
import type { IconContextKey, IconKey, IconNode, MiniAssetEntry } from './types.js';

export type IconParityState = 'active' | 'disabled' | 'inactive' | 'pressed' | 'static';
export type IconParityCoverage = 'asset' | 'same-as-active' | 'same-as-inactive' | 'not-applicable';

export interface IconParityStateMatrix {
  readonly active: IconParityCoverage;
  readonly disabled: IconParityCoverage;
  readonly inactive: IconParityCoverage;
  readonly pressed: IconParityCoverage;
}

export interface IconParityMatrixEntry {
  readonly contextKey: IconContextKey;
  readonly fileKey: string;
  readonly motionKey?: string;
  readonly partKeys: readonly string[];
  readonly semantic: string;
  readonly sourceKey: IconKey;
  readonly state: IconParityState;
  readonly states: IconParityStateMatrix;
}

const semanticsByFileKey: Readonly<Record<string, string>> = {
  backfill: 'workbench.more.backfill',
  bell: 'workbench.more.bell',
  'bell-top': 'workbench.top.notifications',
  calendar: 'workspace.calendar.navigation.base',
  'calendar-muted': 'workspace.calendar.navigation.base',
  'calendar-check': 'workspace.calendar.navigation.check',
  'calendar-check-muted': 'workspace.calendar.navigation.check',
  'chevron-left': 'calendar.period.previous',
  'chevron-right': 'calendar.period.next',
  'chevron-right-muted': 'workbench.more.navigation.next',
  close: 'shared.close',
  config: 'workbench.more.configuration',
  department: 'directory.mode.department',
  'department-muted': 'directory.mode.department',
  'directory-base': 'workspace.directory.navigation.base',
  'directory-base-muted': 'workspace.directory.navigation.base',
  'directory-person': 'workspace.directory.navigation.person',
  'directory-person-muted': 'workspace.directory.navigation.person',
  duty: 'workbench.more.duty',
  events: 'workbench.more.events',
  export: 'workbench.top.export',
  'filter-top': 'calendar.filter.top',
  'filter-middle': 'calendar.filter.middle',
  'filter-bottom': 'calendar.filter.bottom',
  'filter-clear': 'directory.filter.clear',
  'filter-funnel': 'directory.filter.open',
  groups: 'workbench.more.groups',
  history: 'workbench.more.history',
  'info-circle': 'workbench.more.info',
  leave: 'workbench.more.leave',
  locate: 'calendar.navigation.locate',
  lock: 'identity.security.lock',
  manual: 'workbench.more.manual',
  'more-primary': 'workspace.more.navigation.primary',
  'more-primary-muted': 'workspace.more.navigation.primary',
  'more-secondary': 'workspace.more.navigation.secondary',
  'more-secondary-muted': 'workspace.more.navigation.secondary',
  'more-tertiary': 'workspace.more.navigation.tertiary',
  'more-tertiary-muted': 'workspace.more.navigation.tertiary',
  notifications: 'workbench.more.notifications',
  'people-primary': 'directory.mode.people.primary',
  'people-primary-muted': 'directory.mode.people.primary',
  'people-secondary': 'directory.mode.people.secondary',
  'people-secondary-muted': 'directory.mode.people.secondary',
  phone: 'directory.contact.phone',
  'phone-success': 'calendar.contact.phone.success',
  'profile-body': 'workspace.profile.navigation.body',
  'profile-body-muted': 'workspace.profile.navigation.body',
  'profile-portrait': 'workspace.profile.navigation.portrait',
  'profile-portrait-muted': 'workspace.profile.navigation.portrait',
  search: 'directory.search',
  star: 'directory.favorite.star',
  'star-filled': 'directory.favorite.star',
  'swap-left': 'workspace.swap.navigation.left',
  'swap-left-muted': 'workspace.swap.navigation.left',
  'swap-right': 'workspace.swap.navigation.right',
  'swap-right-muted': 'workspace.swap.navigation.right',
  user: 'workbench.top.profile',
};

const motionByFileKey: Readonly<Record<string, string>> = {
  backfill: 'navigation-rewind',
  bell: 'navigation-bell',
  'bell-top': 'bell',
  'calendar-check': 'navigation',
  'calendar-check-muted': 'navigation',
  config: 'navigation-gear',
  department: 'department',
  'department-muted': 'department',
  duty: 'navigation-duty',
  events: 'navigation-events',
  export: 'export',
  'filter-bottom': 'filter',
  'filter-middle': 'filter',
  'filter-top': 'filter',
  groups: 'navigation-enter',
  leave: 'navigation',
  locate: 'locate',
  manual: 'navigation-column',
  'more-primary': 'more-stagger',
  'more-primary-muted': 'more-stagger',
  'more-secondary': 'more-stagger',
  'more-secondary-muted': 'more-stagger',
  'more-tertiary': 'more-stagger',
  'more-tertiary-muted': 'more-stagger',
  notifications: 'navigation-bell',
  'people-primary': 'people',
  'people-primary-muted': 'people',
  'people-secondary': 'people',
  'people-secondary-muted': 'people',
  phone: 'phone',
  'profile-portrait': 'navigation-profile',
  'profile-portrait-muted': 'navigation-profile',
  'swap-left': 'navigation-swap',
  'swap-left-muted': 'navigation-swap',
  'swap-right': 'navigation-swap',
  'swap-right-muted': 'navigation-swap',
  user: 'profile',
};

function collectPartKeys(nodes: readonly IconNode[], result: string[] = []) {
  for (const node of nodes) {
    if (node.part !== undefined) result.push(node.part);
    if (node.kind === 'group') collectPartKeys(node.children, result);
  }
  return result;
}

function contextFor(entry: MiniAssetEntry): IconContextKey {
  return entry.contextKey ?? 'static-action';
}

function statesFor(
  entry: MiniAssetEntry,
  entries: readonly MiniAssetEntry[],
): IconParityStateMatrix {
  if (entry.tone === undefined) {
    return {
      active: 'not-applicable',
      inactive: 'not-applicable',
      pressed: 'not-applicable',
      disabled: 'not-applicable',
    };
  }
  const sameStateEntries = entries.filter(
    (candidate) =>
      candidate.sourceKey === entry.sourceKey &&
      contextFor(candidate) === contextFor(entry) &&
      semanticsByFileKey[candidate.fileKey] === semanticsByFileKey[entry.fileKey],
  );
  const hasActive = sameStateEntries.some((candidate) => candidate.tone === 'active');
  const hasInactive = sameStateEntries.some((candidate) => candidate.tone === 'inactive');
  return {
    active: hasActive ? 'asset' : 'not-applicable',
    inactive: hasInactive ? 'asset' : 'not-applicable',
    pressed: hasActive ? 'same-as-active' : 'same-as-inactive',
    disabled: hasInactive ? 'same-as-inactive' : 'not-applicable',
  };
}

export const iconParityMatrix: readonly IconParityMatrixEntry[] = miniAssetEntries.map((entry) => {
  const semantic = semanticsByFileKey[entry.fileKey];
  if (semantic === undefined) throw new Error(`Missing icon parity semantic: ${entry.fileKey}`);
  const definition = iconCatalog[entry.sourceKey];
  const motionKey = motionByFileKey[entry.fileKey];
  return {
    fileKey: entry.fileKey,
    sourceKey: entry.sourceKey,
    semantic,
    contextKey: contextFor(entry),
    state: entry.tone ?? 'static',
    states: statesFor(entry, miniAssetEntries),
    partKeys: collectPartKeys(definition.nodes),
    ...(motionKey === undefined ? {} : { motionKey }),
  };
});

export { semanticsByFileKey };
