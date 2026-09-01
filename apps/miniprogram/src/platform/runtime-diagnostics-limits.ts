export const RUNTIME_DIAGNOSTIC_REQUEST_LIMIT = 20;
export const RUNTIME_DIAGNOSTIC_ERROR_LIMIT = 10;
export const RUNTIME_DIAGNOSTIC_PERFORMANCE_LIMIT = 12;
export const RUNTIME_DIRECTORY_SEARCH_LIMIT = 20;

// A fixed-field search record is normally below 2 KiB. 4 KiB leaves room for future
// allowlisted numeric phases without permitting unbounded business text.
export const RUNTIME_DIRECTORY_RECORD_MAX_BYTES = 4 * 1024;

// Ten normal records fit comfortably below this ceiling while clipboard work remains bounded.
export const RUNTIME_DIAGNOSTIC_COPY_MAX_BYTES = 24 * 1024;

export const RUNTIME_DIAGNOSTIC_HEADER_VALUE_MAX_LENGTH = 4 * 1024;
export const RUNTIME_DIAGNOSTIC_REQUEST_ID_MAX_LENGTH = 64;
export const RUNTIME_DIAGNOSTIC_REQUEST_ID_PATTERN = /^[0-9A-Za-z._:-]+$/u;
