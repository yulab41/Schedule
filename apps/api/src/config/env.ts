import { clientVersionSchema, type ClientVersion } from '@schedule/contracts';
import { z } from 'zod';

const portSchema = z.coerce.number().int().min(1).max(65_535);
const requiredTextSchema = z.string().trim().min(1);
const optionalTextSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim().length === 0 ? undefined : value),
  requiredTextSchema.optional(),
);
const applicationSettings = {
  API_HOST: requiredTextSchema.default('127.0.0.1'),
  API_PORT: portSchema.default(3000),
};
const databaseSettings = {
  MYSQL_HOST: requiredTextSchema.default('127.0.0.1'),
  MYSQL_PORT: portSchema.default(3306),
  MYSQL_DATABASE: requiredTextSchema,
  MYSQL_USER: requiredTextSchema,
  MYSQL_PASSWORD: requiredTextSchema,
};
const operationSettings = {
  BACKUP_DIR: requiredTextSchema.default('./backups'),
  BACKUP_ENCRYPTION_KEY: optionalTextSchema,
};
const wechatSettings = {
  WECHAT_APPID: optionalTextSchema,
  WECHAT_APPSECRET: optionalTextSchema,
  WECHAT_SESSION_SECRET: optionalTextSchema,
  WECHAT_WEB_APPID: optionalTextSchema,
  WECHAT_WEB_APPSECRET: optionalTextSchema,
  WECHAT_WEB_REDIRECT_URI: optionalTextSchema,
  WECHAT_MOCK_MODE: z.enum(['true', 'false']).default('false'),
  WECHAT_QR_ENV_VERSION: z.enum(['develop', 'trial', 'release']).default('release'),
  WECHAT_DUTY_REMINDER_TEMPLATE_ID: optionalTextSchema,
};
const authSettings = {
  AUTH_PASSWORD_ENABLED: z.enum(['true', 'false']).default('false'),
};
const strictBooleanStringSchema = z.enum(['true', 'false']).default('false');
const supportedClientVersionsSchema = z.preprocess(
  (value) => {
    if (value === undefined || (typeof value === 'string' && value.trim().length === 0)) {
      return [];
    }
    return typeof value === 'string' ? value.split(',').map((part) => part.trim()) : value;
  },
  z
    .array(clientVersionSchema)
    .refine((versions) => new Set(versions).size === versions.length, 'versions must be unique'),
);
const optionalClientVersionSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim().length === 0 ? undefined : value),
  clientVersionSchema.optional(),
);
const clientCapabilitySettings = {
  MINIPROGRAM_CAPABILITY_CORE_ENABLED: strictBooleanStringSchema,
  MINIPROGRAM_CAPABILITY_EXTERNAL_MESSAGES_ENABLED: strictBooleanStringSchema,
  MINIPROGRAM_CAPABILITY_GLOBAL_ENABLED: strictBooleanStringSchema,
  MINIPROGRAM_CAPABILITY_GUEST_ENABLED: strictBooleanStringSchema,
  MINIPROGRAM_CAPABILITY_INSIGHTS_ENABLED: strictBooleanStringSchema,
  MINIPROGRAM_CAPABILITY_ORGANIZATION_ENABLED: strictBooleanStringSchema,
  MINIPROGRAM_CAPABILITY_WORKFLOWS_ENABLED: strictBooleanStringSchema,
  MINIPROGRAM_LEGACY_CLIENT_VERSION: optionalClientVersionSchema,
  MINIPROGRAM_SUPPORTED_CLIENT_VERSIONS: supportedClientVersionsSchema,
};
const vapidSettings = {
  VAPID_PRIVATE_KEY: optionalTextSchema,
  VAPID_PUBLIC_KEY: optionalTextSchema,
  VAPID_SUBJECT: optionalTextSchema,
};

function hasCompleteVapidConfiguration(environment: {
  readonly VAPID_PRIVATE_KEY?: string | undefined;
  readonly VAPID_PUBLIC_KEY?: string | undefined;
  readonly VAPID_SUBJECT?: string | undefined;
}): boolean {
  const configuredValues = [
    environment.VAPID_PRIVATE_KEY,
    environment.VAPID_PUBLIC_KEY,
    environment.VAPID_SUBJECT,
  ].filter((value) => value !== undefined);
  return configuredValues.length === 0 || configuredValues.length === 3;
}

function hasCompleteWebWechatConfiguration(environment: {
  readonly WECHAT_WEB_APPID?: string | undefined;
  readonly WECHAT_WEB_APPSECRET?: string | undefined;
  readonly WECHAT_WEB_REDIRECT_URI?: string | undefined;
}): boolean {
  const configuredValues = [
    environment.WECHAT_WEB_APPID,
    environment.WECHAT_WEB_APPSECRET,
    environment.WECHAT_WEB_REDIRECT_URI,
  ].filter((value) => value !== undefined);
  return configuredValues.length === 0 || configuredValues.length === 3;
}

function hasValidProductionPasswordConfiguration(environment: {
  readonly NODE_ENV: 'development' | 'test' | 'production';
  readonly AUTH_PASSWORD_ENABLED: 'true' | 'false';
  readonly WECHAT_SESSION_SECRET?: string | undefined;
}): boolean {
  if (environment.NODE_ENV !== 'production') {
    return true;
  }
  if (environment.AUTH_PASSWORD_ENABLED !== 'true') {
    return false;
  }
  if (
    environment.WECHAT_SESSION_SECRET === undefined ||
    environment.WECHAT_SESSION_SECRET.length < 32
  ) {
    return false;
  }
  return true;
}

function hasValidClientVersionConfiguration(environment: {
  readonly MINIPROGRAM_LEGACY_CLIENT_VERSION?: ClientVersion | undefined;
  readonly MINIPROGRAM_SUPPORTED_CLIENT_VERSIONS: readonly ClientVersion[];
}): boolean {
  const supported = environment.MINIPROGRAM_SUPPORTED_CLIENT_VERSIONS;
  const legacy = environment.MINIPROGRAM_LEGACY_CLIENT_VERSION;
  if (supported.length === 0) return legacy === undefined;
  return legacy !== undefined && supported.includes(legacy);
}

export const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    AUTH_DEV_MODE: z.enum(['true', 'false']).default('false'),
    ...authSettings,
    ...clientCapabilitySettings,
    ...applicationSettings,
    ...databaseSettings,
    ...operationSettings,
    ...vapidSettings,
    ...wechatSettings,
  })
  .refine(
    (environment) =>
      environment.NODE_ENV !== 'production' || environment.WECHAT_MOCK_MODE !== 'true',
    {
      message: 'mock mode is forbidden in production',
      path: ['WECHAT_MOCK_MODE'],
    },
  )
  .refine(
    (environment) => environment.NODE_ENV !== 'production' || environment.AUTH_DEV_MODE !== 'true',
    {
      message: 'development authentication is forbidden in production',
      path: ['AUTH_DEV_MODE'],
    },
  )
  .refine(hasCompleteVapidConfiguration, {
    message: 'VAPID_SUBJECT, VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be configured together',
    path: ['VAPID_SUBJECT'],
  })
  .refine(hasValidClientVersionConfiguration, {
    message:
      'MINIPROGRAM_LEGACY_CLIENT_VERSION must be included in MINIPROGRAM_SUPPORTED_CLIENT_VERSIONS, or both must be empty',
    path: ['MINIPROGRAM_SUPPORTED_CLIENT_VERSIONS'],
  })
  .refine(hasCompleteWebWechatConfiguration, {
    message:
      'WECHAT_WEB_APPID, WECHAT_WEB_APPSECRET and WECHAT_WEB_REDIRECT_URI must be configured together',
    path: ['WECHAT_WEB_APPID'],
  })
  .refine(hasValidProductionPasswordConfiguration, {
    message:
      'production password authentication requires AUTH_PASSWORD_ENABLED=true and a 32-byte session secret',
    path: ['AUTH_PASSWORD_ENABLED'],
  });
const testEnvironmentSchema = z
  .object({
    NODE_ENV: z.literal('test'),
    AUTH_DEV_MODE: z.enum(['true', 'false']).default('false'),
    ...authSettings,
    ...clientCapabilitySettings,
    ...applicationSettings,
    BACKUP_DIR: requiredTextSchema.default('./backups'),
    TEST_MYSQL_HOST: requiredTextSchema.default('127.0.0.1'),
    TEST_MYSQL_PORT: portSchema.default(3307),
    TEST_MYSQL_DATABASE: requiredTextSchema,
    TEST_MYSQL_USER: requiredTextSchema,
    TEST_MYSQL_PASSWORD: requiredTextSchema,
    ...vapidSettings,
    ...wechatSettings,
  })
  .refine(hasCompleteVapidConfiguration, {
    message: 'VAPID_SUBJECT, VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be configured together',
    path: ['VAPID_SUBJECT'],
  })
  .refine(hasValidClientVersionConfiguration, {
    message:
      'MINIPROGRAM_LEGACY_CLIENT_VERSION must be included in MINIPROGRAM_SUPPORTED_CLIENT_VERSIONS, or both must be empty',
    path: ['MINIPROGRAM_SUPPORTED_CLIENT_VERSIONS'],
  });

export type Environment = z.infer<typeof environmentSchema>;

export class EnvironmentValidationError extends Error {
  public constructor(issues: readonly string[]) {
    super(`Environment configuration is invalid: ${issues.join('; ')}`);
    this.name = 'EnvironmentValidationError';
  }
}

export function loadEnvironment(values: NodeJS.ProcessEnv = process.env): Environment {
  if (values.NODE_ENV === 'test') {
    const testResult = testEnvironmentSchema.safeParse(values);

    if (!testResult.success) {
      throw new EnvironmentValidationError(getIssueMessages(testResult.error));
    }

    return {
      NODE_ENV: testResult.data.NODE_ENV,
      AUTH_DEV_MODE: testResult.data.AUTH_DEV_MODE,
      AUTH_PASSWORD_ENABLED: testResult.data.AUTH_PASSWORD_ENABLED,
      API_HOST: testResult.data.API_HOST,
      API_PORT: testResult.data.API_PORT,
      BACKUP_DIR: testResult.data.BACKUP_DIR,
      MINIPROGRAM_CAPABILITY_CORE_ENABLED: testResult.data.MINIPROGRAM_CAPABILITY_CORE_ENABLED,
      MINIPROGRAM_CAPABILITY_EXTERNAL_MESSAGES_ENABLED:
        testResult.data.MINIPROGRAM_CAPABILITY_EXTERNAL_MESSAGES_ENABLED,
      MINIPROGRAM_CAPABILITY_GLOBAL_ENABLED: testResult.data.MINIPROGRAM_CAPABILITY_GLOBAL_ENABLED,
      MINIPROGRAM_CAPABILITY_GUEST_ENABLED: testResult.data.MINIPROGRAM_CAPABILITY_GUEST_ENABLED,
      MINIPROGRAM_CAPABILITY_INSIGHTS_ENABLED:
        testResult.data.MINIPROGRAM_CAPABILITY_INSIGHTS_ENABLED,
      MINIPROGRAM_CAPABILITY_ORGANIZATION_ENABLED:
        testResult.data.MINIPROGRAM_CAPABILITY_ORGANIZATION_ENABLED,
      MINIPROGRAM_CAPABILITY_WORKFLOWS_ENABLED:
        testResult.data.MINIPROGRAM_CAPABILITY_WORKFLOWS_ENABLED,
      MINIPROGRAM_LEGACY_CLIENT_VERSION: testResult.data.MINIPROGRAM_LEGACY_CLIENT_VERSION,
      MINIPROGRAM_SUPPORTED_CLIENT_VERSIONS: testResult.data.MINIPROGRAM_SUPPORTED_CLIENT_VERSIONS,
      VAPID_PRIVATE_KEY: testResult.data.VAPID_PRIVATE_KEY,
      VAPID_PUBLIC_KEY: testResult.data.VAPID_PUBLIC_KEY,
      VAPID_SUBJECT: testResult.data.VAPID_SUBJECT,
      MYSQL_HOST: testResult.data.TEST_MYSQL_HOST,
      MYSQL_PORT: testResult.data.TEST_MYSQL_PORT,
      MYSQL_DATABASE: testResult.data.TEST_MYSQL_DATABASE,
      MYSQL_USER: testResult.data.TEST_MYSQL_USER,
      MYSQL_PASSWORD: testResult.data.TEST_MYSQL_PASSWORD,
      WECHAT_APPID: testResult.data.WECHAT_APPID,
      WECHAT_APPSECRET: testResult.data.WECHAT_APPSECRET,
      WECHAT_SESSION_SECRET: testResult.data.WECHAT_SESSION_SECRET,
      WECHAT_WEB_APPID: testResult.data.WECHAT_WEB_APPID,
      WECHAT_WEB_APPSECRET: testResult.data.WECHAT_WEB_APPSECRET,
      WECHAT_WEB_REDIRECT_URI: testResult.data.WECHAT_WEB_REDIRECT_URI,
      WECHAT_MOCK_MODE: testResult.data.WECHAT_MOCK_MODE,
      WECHAT_QR_ENV_VERSION: testResult.data.WECHAT_QR_ENV_VERSION,
      WECHAT_DUTY_REMINDER_TEMPLATE_ID: testResult.data.WECHAT_DUTY_REMINDER_TEMPLATE_ID,
    };
  }

  const result = environmentSchema.safeParse(values);

  if (!result.success) {
    throw new EnvironmentValidationError(getIssueMessages(result.error));
  }

  return result.data;
}

function getIssueMessages(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const field = issue.path.join('.') || 'environment';
    return `${field}: ${issue.message}`;
  });
}
