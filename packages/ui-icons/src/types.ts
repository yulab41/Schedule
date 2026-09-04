export type IconKey =
  | 'backfill'
  | 'bell'
  | 'calendar'
  | 'calendar-base'
  | 'calendar-check'
  | 'chevron-left'
  | 'chevron-right'
  | 'close'
  | 'config'
  | 'department'
  | 'directory'
  | 'directory-base'
  | 'directory-person'
  | 'duty'
  | 'download'
  | 'error-circle'
  | 'events'
  | 'export'
  | 'filter'
  | 'filter-bottom'
  | 'filter-clear'
  | 'filter-funnel'
  | 'filter-middle'
  | 'filter-top'
  | 'groups'
  | 'history'
  | 'info-circle'
  | 'leave'
  | 'leave-minus'
  | 'locate'
  | 'lock'
  | 'logout'
  | 'manual'
  | 'members'
  | 'more'
  | 'more-primary'
  | 'more-secondary'
  | 'more-tertiary'
  | 'notifications'
  | 'people'
  | 'people-primary'
  | 'people-secondary'
  | 'phone'
  | 'profile'
  | 'profile-body'
  | 'profile-portrait'
  | 'search'
  | 'star'
  | 'star-filled'
  | 'statistics'
  | 'swap'
  | 'swap-left'
  | 'swap-right'
  | 'user'
  | 'wifi-off';

export type IconPaint = 'none' | 'currentColor';

export interface IconNodeBase {
  readonly key: string;
  readonly part?: string;
}

export interface IconPathNode extends IconNodeBase {
  readonly kind: 'path';
  readonly d: string;
  readonly fill?: IconPaint;
  readonly stroke?: IconPaint;
  readonly fillRule?: 'evenodd' | 'nonzero';
  readonly clipRule?: 'evenodd' | 'nonzero';
  readonly pathLength?: number;
}

export interface IconCircleNode extends IconNodeBase {
  readonly kind: 'circle';
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
  readonly fill?: IconPaint;
  readonly stroke?: IconPaint;
}

export interface IconRectNode extends IconNodeBase {
  readonly kind: 'rect';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rx?: number;
  readonly fill?: IconPaint;
  readonly stroke?: IconPaint;
}

export interface IconGroupNode extends IconNodeBase {
  readonly kind: 'group';
  readonly children: readonly IconNode[];
}

export type IconNode = IconPathNode | IconCircleNode | IconRectNode | IconGroupNode;

export interface IconDefinition {
  readonly key: IconKey;
  readonly aliases: readonly string[];
  readonly viewBox: '0 0 24 24';
  readonly nodes: readonly IconNode[];
  readonly strokeWidth: number;
  readonly lineCap: 'butt' | 'round' | 'square';
  readonly lineJoin: 'bevel' | 'miter' | 'round';
  readonly sourceRef: string;
  readonly licenseRef: string;
  /** Git/source revision fingerprint; content hashing is performed by the generator. */
  readonly sourceSha: string;
}

export type IconColorRole =
  'danger' | 'directoryModeInactive' | 'favorite' | 'muted' | 'primary' | 'secondary' | 'success';

export type IconContextKey =
  | 'calendar-filter'
  | 'calendar-locate'
  | 'calendar-phone-small'
  | 'desktop-navigation'
  | 'directory-favorite'
  | 'directory-mode'
  | 'directory-phone'
  | 'duty-phone'
  | 'mobile-bottom-navigation'
  | 'more-row'
  | 'static-action'
  | 'top-bell'
  | 'top-profile';

export type MiniAssetTone = 'active' | 'inactive';

interface MiniAssetEntryBase {
  readonly fileKey: string;
  readonly sourceKey: IconKey;
}

export type MiniAssetEntry =
  | (MiniAssetEntryBase & {
      readonly colorRole: IconColorRole;
      readonly contextKey?: never;
      readonly strokeWidth?: number;
      readonly tone?: never;
    })
  | (MiniAssetEntryBase & {
      readonly colorRole?: never;
      readonly contextKey: IconContextKey;
      readonly strokeWidth?: never;
      readonly tone: MiniAssetTone;
    });
