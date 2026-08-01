import { z } from 'zod';

const portSchema = z.coerce.number().int().min(1).max(65_535);
const requiredTextSchema = z.string().trim().min(1);
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

export const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  ...applicationSettings,
  ...databaseSettings,
});
const testEnvironmentSchema = z.object({
  NODE_ENV: z.literal('test'),
  ...applicationSettings,
  TEST_MYSQL_HOST: requiredTextSchema.default('127.0.0.1'),
  TEST_MYSQL_PORT: portSchema.default(3307),
  TEST_MYSQL_DATABASE: requiredTextSchema,
  TEST_MYSQL_USER: requiredTextSchema,
  TEST_MYSQL_PASSWORD: requiredTextSchema,
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
      API_HOST: testResult.data.API_HOST,
      API_PORT: testResult.data.API_PORT,
      MYSQL_HOST: testResult.data.TEST_MYSQL_HOST,
      MYSQL_PORT: testResult.data.TEST_MYSQL_PORT,
      MYSQL_DATABASE: testResult.data.TEST_MYSQL_DATABASE,
      MYSQL_USER: testResult.data.TEST_MYSQL_USER,
      MYSQL_PASSWORD: testResult.data.TEST_MYSQL_PASSWORD,
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
