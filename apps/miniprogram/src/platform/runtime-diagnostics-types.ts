export type DiagnosticRequestOutcome = 'failed' | 'http-error' | 'success';

export interface RuntimeDiagnosticNetworkProfile {
  readonly connectMs?: number | undefined;
  readonly dnsMs?: number | undefined;
  readonly downloadMs?: number | undefined;
  readonly supported: boolean;
  readonly tlsMs?: number | undefined;
  readonly ttfbMs?: number | undefined;
}

export interface RuntimeDiagnosticServerTiming {
  readonly aliasMs?: number | undefined;
  readonly authMs?: number | undefined;
  readonly batchMs?: number | undefined;
  readonly cache?: 'hit' | 'miss' | 'none' | 'unsupported' | undefined;
  readonly coldStart?: boolean | undefined;
  readonly contactsMs?: number | undefined;
  readonly countMs?: number | undefined;
  readonly databaseWaitMs?: number | undefined;
  readonly instanceAgeMs?: number | undefined;
  readonly permissionMs?: number | undefined;
  readonly queryMs?: number | undefined;
  readonly queueSupported?: boolean | undefined;
  readonly rowsMs?: number | undefined;
  readonly serializationMs?: number | undefined;
  readonly supported: boolean;
  readonly totalMs?: number | undefined;
  readonly transformMs?: number | undefined;
}

export interface RuntimeDiagnosticRequest {
  readonly capabilityWaitMs?: number | undefined;
  readonly completedAt?: number | undefined;
  readonly contextWaitMs?: number | undefined;
  readonly duplicate: boolean;
  readonly durationMs: number;
  readonly endpoint: string;
  readonly issuedAt?: number | undefined;
  readonly method: 'DELETE' | 'GET' | 'POST' | 'PUT';
  readonly networkProfile?: RuntimeDiagnosticNetworkProfile | undefined;
  readonly outcome: DiagnosticRequestOutcome;
  readonly profileEnabled: boolean;
  readonly requestId?: string | undefined;
  readonly retryCount: number;
  readonly serverTiming?: RuntimeDiagnosticServerTiming | undefined;
  readonly startedAt: number;
  readonly statusCode?: number | undefined;
}

export type RuntimeDirectorySearchOutcome = 'failed' | 'success' | 'superseded';
export type RuntimeDirectorySearchType = 'employee-code' | 'name' | 'other' | 'phone';

export interface RuntimeDirectorySearchDiagnostic {
  readonly appLaunchToConfirmMs: number;
  readonly autoStartedByLaunchMarker: boolean;
  readonly cardBuildMs: number;
  readonly completedResultReuse: boolean;
  readonly confirmedAt: number;
  readonly contextWaitMs: number;
  readonly diagnosticId: string;
  readonly diagnosticSerializationMs: number;
  readonly directoryKind: 'employee' | 'internal';
  readonly directoryPageLoadToConfirmMs: number;
  readonly duplicateRequestIntercepted: boolean;
  readonly eventHandlerStartMs: number;
  readonly facetsOrReleaseWaitMs: number;
  readonly facetsReady: boolean;
  readonly firstSearchInPageSession: boolean;
  readonly hasFilters: boolean;
  readonly hasNextPage: boolean;
  readonly inFlightRequestReuse: boolean;
  readonly networkProfile: RuntimeDiagnosticNetworkProfile;
  readonly networkRequestStartMs: number;
  readonly networkResponseMs: number;
  readonly newAppLaunchObserved: boolean;
  readonly nextRenderCycleMs: number;
  readonly outcome: RuntimeDirectorySearchOutcome;
  readonly pageSessionSearchIndex: number;
  readonly profileEnabled: boolean;
  readonly publishedBatchConfirmed: boolean;
  readonly recordedAt: number;
  readonly requestId: string;
  readonly responseBytes: number;
  readonly responseBytesEstimated: boolean;
  readonly responseToConversionMs: number;
  readonly resultCount: number;
  readonly searchTermLength: number;
  readonly searchType: RuntimeDirectorySearchType;
  readonly serverTiming: RuntimeDiagnosticServerTiming;
  readonly setDataBytesEstimated: boolean;
  readonly setDataCallCount: number;
  readonly setDataCommitMs: number;
  readonly setDataMaxBytes: number;
  readonly setDataTotalBytes: number;
  readonly totalMs: number;
  readonly truncated: boolean;
  readonly warmResume: boolean;
}

export interface RuntimeDiagnosticError {
  readonly code: string;
  readonly fingerprint: string;
  readonly page: string;
  readonly recordedAt: number;
}

export interface RuntimeDiagnosticPerformance {
  readonly durationMs: number;
  readonly metric: string;
  readonly page: string;
  readonly recordedAt: number;
}

// Session-only, fixed-position transport format. Human-readable field names are restored only
// inside the diagnostics subpackage so App and organization hot paths do not carry report schemas.
export type RuntimeDirectorySearchPackedRecord = readonly unknown[];

export interface RuntimeDiagnosticsSlot {
  appLaunchAt: number;
  directorySearchRecording: boolean;
  readonly directorySearches: RuntimeDirectorySearchPackedRecord[];
  readonly errors: RuntimeDiagnosticError[];
  launchMarkerConsumed: boolean;
  launchObserved: boolean;
  initialShowPending: boolean;
  readonly performance: RuntimeDiagnosticPerformance[];
  readonly requests: RuntimeDiagnosticRequestInput[];
  warmResumeObserved: boolean;
}

export interface RuntimeDiagnosticsSnapshot {
  readonly appLaunchAt: number;
  readonly directorySearches: readonly RuntimeDirectorySearchDiagnostic[];
  readonly directorySearchRecording: boolean;
  readonly errors: readonly RuntimeDiagnosticError[];
  readonly launchMarkerConsumed: boolean;
  readonly launchObserved: boolean;
  readonly performance: readonly RuntimeDiagnosticPerformance[];
  readonly requests: readonly RuntimeDiagnosticRequest[];
}

export type RuntimeDiagnosticRequestInput = Omit<
  RuntimeDiagnosticRequest,
  'duplicate' | 'durationMs' | 'endpoint' | 'profileEnabled' | 'retryCount'
> & {
  readonly durationMs: number;
  readonly endpoint: string;
  readonly profileEnabled?: boolean | undefined;
  readonly retryCount: number;
};

export interface RuntimeRequestDiagnosticRawObservation {
  readonly responseHeader?: Readonly<Record<string, unknown>> | undefined;
  readonly requestProfile?: unknown;
}

export interface RuntimeRequestDiagnosticObservation {
  readonly networkProfile?: RuntimeDiagnosticNetworkProfile | undefined;
  readonly requestId?: string | undefined;
  readonly serverTiming?: RuntimeDiagnosticServerTiming | undefined;
}

export interface RuntimeRequestDiagnosticObserver {
  readonly header?: Readonly<Record<string, string>> | undefined;
  observe(input: RuntimeRequestDiagnosticRawObservation): RuntimeRequestDiagnosticObservation;
  shouldObserve(endpointId: string): boolean;
}
