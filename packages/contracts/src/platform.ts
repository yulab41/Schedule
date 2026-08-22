export type PlatformBackupKind = 'daily' | 'monthly';

export type PlatformJobRunStatus = 'completed' | 'failed' | 'running';

export interface PlatformJobRun {
  readonly finishedAt?: string;
  readonly id: string;
  readonly jobName: string;
  readonly startedAt: string;
  readonly status: PlatformJobRunStatus;
  readonly summary?: string;
}

export interface PlatformJobStatusPage {
  readonly runs: readonly PlatformJobRun[];
}

export interface PlatformBackup {
  readonly backupKind: PlatformBackupKind;
  readonly createdAt: string;
  readonly fileSize: number;
  readonly id: string;
  readonly rowCount: number;
  readonly sha256: string;
  readonly storageKey: string;
  readonly tableCount: number;
}

export interface PlatformBackupList {
  readonly archives: readonly PlatformBackup[];
}

export interface PlatformMeResponse {
  readonly isPlatformAdmin: boolean;
}

export interface UpdatePlatformUserStatusInput {
  readonly status: 'active' | 'suspended';
}
