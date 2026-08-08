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
  WECHAT_MOCK_MODE: z.enum(['true', 'false']).default('false'),
  WECHAT_QR_ENV_VERSION: z.enum(['develop', 'trial', 'release']).default('release'),
  WECHAT_DUTY_REMINDER_TEMPLATE_ID: optionalTextSchema,
};

export const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    AUTH_DEV_MODE: z.enum(['true', 'false']).default('false'),
    ...applicationSettings,
    ...databaseSettings,
    ...operationSettings,
    ...wechatSettings,
  })
  .refine(
    (environment) =>
      environment.NODE_ENV !== 'production' || environment.WECHAT_MOCK_MODE !== 'true',
    {
      message: 'mock mode is forbidden in production',
      path: ['WECHAT_MOCK_MODE'],
    },
  );
const testEnvironmentSchema = z.object({
  NODE_ENV: z.literal('test'),
  AUTH_DEV_MODE: z.enum(['true', 'false']).default('false'),
  ...applicationSettings,
  BACKUP_DIR: requiredTextSchema.default('./backups'),
  TEST_MYSQL_HOST: requiredTextSchema.default('127.0.0.1'),
  TEST_MYSQL_PORT: portSchema.default(3307),
  TEST_MYSQL_DATABASE: requiredTextSchema,
  TEST_MYSQL_USER: requiredTextSchema,
  TEST_MYSQL_PASSWORD: requiredTextSchema,
  ...wechatSettings,
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
      API_HOST: testResult.data.API_HOST,
      API_PORT: testResult.data.API_PORT,
      BACKUP_DIR: testResult.data.BACKUP_DIR,
      MYSQL_HOST: testResult.data.TEST_MYSQL_HOST,
      MYSQL_PORT: testResult.data.TEST_MYSQL_PORT,
      MYSQL_DATABASE: testResult.data.TEST_MYSQL_DATABASE,
      MYSQL_USER: testResult.data.TEST_MYSQL_USER,
      MYSQL_PASSWORD: testResult.data.TEST_MYSQL_PASSWORD,
      WECHAT_APPID: testResult.data.WECHAT_APPID,
      WECHAT_APPSECRET: testResult.data.WECHAT_APPSECRET,
      WECHAT_SESSION_SECRET: testResult.data.WECHAT_SESSION_SECRET,
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
