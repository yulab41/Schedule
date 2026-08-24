CREATE TABLE `miniprogram_telemetry_events` (
  `id` CHAR(36) NOT NULL,
  `client_version` VARCHAR(64) NOT NULL,
  `page` ENUM(
    'app',
    'identity',
    'workbench',
    'manual-matrix',
    'manual-schedule',
    'backfill',
    'group-settings',
    'unknown'
  ) NOT NULL,
  `device_tier` ENUM('low', 'medium', 'high', 'unknown') NOT NULL,
  `error_code` ENUM(
    'AUTHENTICATION_REQUIRED',
    'CLIENT_CAPABILITY_DISABLED',
    'CLIENT_VERSION_UNSUPPORTED',
    'INVALID_RESPONSE',
    'MINI_RUNTIME_ERROR',
    'NETWORK_ERROR',
    'TIMEOUT',
    'UNKNOWN'
  ) NULL,
  `network_type` ENUM('none', 'wifi', '2g', '3g', '4g', '5g', 'unknown') NOT NULL,
  `performance_metric` ENUM(
    'core-ready',
    'foreground-ready',
    'maximum-matrix-render',
    'tap-feedback'
  ) NULL,
  `performance_duration_ms` INT UNSIGNED NULL,
  `stack_fingerprint` CHAR(64) NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `miniprogram_telemetry_created_idx` (`created_at`, `id`),
  KEY `miniprogram_telemetry_version_page_idx` (`client_version`, `page`, `created_at`),
  KEY `miniprogram_telemetry_error_fingerprint_idx` (
    `error_code`,
    `stack_fingerprint`,
    `created_at`
  ),
  CONSTRAINT `miniprogram_telemetry_error_or_performance_check`
    CHECK (`error_code` IS NOT NULL OR `performance_metric` IS NOT NULL),
  CONSTRAINT `miniprogram_telemetry_performance_pair_check`
    CHECK ((`performance_metric` IS NULL) = (`performance_duration_ms` IS NULL)),
  CONSTRAINT `miniprogram_telemetry_stack_requires_error_check`
    CHECK (`stack_fingerprint` IS NULL OR `error_code` IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
