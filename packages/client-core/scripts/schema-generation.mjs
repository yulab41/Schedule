const ignoredSchemaKeys = new Set(['$schema', 'readOnly']);
const supportedSchemaKeys = new Set([
  'additionalProperties',
  'enum',
  'items',
  'maximum',
  'minLength',
  'minimum',
  'pattern',
  'properties',
  'required',
  'type',
]);
const supportedSchemaTypes = new Set(['array', 'boolean', 'integer', 'number', 'object', 'string']);

export function sanitizeJsonSchema(schema, path = '$') {
  if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) {
    throw new Error(`${path} must be a JSON schema object`);
  }
  for (const key of Object.keys(schema)) {
    if (!ignoredSchemaKeys.has(key) && !supportedSchemaKeys.has(key)) {
      throw new Error(`${path} uses unsupported JSON schema keyword: ${key}`);
    }
  }
  if (typeof schema.type !== 'string' || !supportedSchemaTypes.has(schema.type)) {
    throw new Error(`${path}.type must be an explicitly supported type`);
  }

  const result = { type: schema.type };
  if (schema.properties !== undefined) {
    if (
      schema.properties === null ||
      typeof schema.properties !== 'object' ||
      Array.isArray(schema.properties)
    ) {
      throw new Error(`${path}.properties must be an object`);
    }
    result.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([name, propertySchema]) => [
        name,
        sanitizeJsonSchema(propertySchema, `${path}.properties.${name}`),
      ]),
    );
  }
  if (schema.required !== undefined) result.required = [...schema.required];
  if (schema.additionalProperties !== undefined) {
    if (schema.additionalProperties !== false) {
      throw new Error(`${path}.additionalProperties must fail closed`);
    }
    result.additionalProperties = false;
  }
  if (schema.items !== undefined) {
    result.items = sanitizeJsonSchema(schema.items, `${path}.items`);
  }
  if (schema.enum !== undefined) result.enum = [...schema.enum];
  for (const key of ['maximum', 'minLength', 'minimum', 'pattern']) {
    if (schema[key] !== undefined) result[key] = schema[key];
  }
  return result;
}

export function renderGeneratedSchemas({ calendar, holidays }) {
  return [
    "import type { CompactJsonSchema } from '../json-decoder.js';",
    '',
    'const calendarReadModelSchemaJson =',
    `  ${quoteJson(calendar)};`,
    'const holidayReadModelSchemaJson =',
    `  ${quoteJson(holidays)};`,
    '',
    'export const calendarReadModelJsonSchema = JSON.parse(',
    '  calendarReadModelSchemaJson,',
    ') as CompactJsonSchema;',
    'export const holidayReadModelJsonSchema = JSON.parse(',
    '  holidayReadModelSchemaJson,',
    ') as CompactJsonSchema;',
    '',
  ].join('\n');
}

export function isGeneratedSourceCurrent(currentSource, generatedSource) {
  return normalizeLineEndings(currentSource) === normalizeLineEndings(generatedSource);
}

function quoteJson(value) {
  const json = JSON.stringify(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'");
  return `'${json}'`;
}

function normalizeLineEndings(value) {
  return value.replace(/\r\n?/gu, '\n');
}
