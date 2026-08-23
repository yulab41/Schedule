const ignoredSchemaKeys = new Set(['$schema', 'readOnly']);
const supportedSchemaKeys = new Set([
  'additionalProperties',
  'const',
  'enum',
  'format',
  'items',
  'maxItems',
  'maxLength',
  'maximum',
  'minItems',
  'minLength',
  'minimum',
  'pattern',
  'prefixItems',
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
  if (schema.prefixItems !== undefined) {
    if (!Array.isArray(schema.prefixItems) || schema.prefixItems.length === 0) {
      throw new Error(`${path}.prefixItems must be a non-empty tuple`);
    }
    const tupleItems = schema.prefixItems.map((item, index) =>
      sanitizeJsonSchema(item, `${path}.prefixItems[${index}]`),
    );
    const firstItem = JSON.stringify(tupleItems[0]);
    if (!tupleItems.every((item) => JSON.stringify(item) === firstItem)) {
      throw new Error(`${path}.prefixItems must use one homogeneous item schema`);
    }
    result.items = tupleItems[0];
    result.minItems = tupleItems.length;
    result.maxItems = tupleItems.length;
  }
  if (schema.enum !== undefined) result.enum = [...schema.enum];
  if (schema.const !== undefined) {
    if (!['boolean', 'number', 'string'].includes(typeof schema.const)) {
      throw new Error(`${path}.const must be a supported primitive`);
    }
    result.const = schema.const;
  }
  if (schema.format !== undefined) {
    if (schema.format !== 'date-time' && schema.format !== 'uuid') {
      throw new Error(`${path}.format must be date-time or uuid`);
    }
    result.format = schema.format;
  }
  for (const key of [
    'maximum',
    'maxItems',
    'maxLength',
    'minItems',
    'minLength',
    'minimum',
    'pattern',
  ]) {
    if (schema[key] !== undefined) result[key] = schema[key];
  }
  return result;
}

export function renderGeneratedSchemas({ errorCodes, schemas }) {
  const schemaEntries = Object.entries(schemas);
  return [
    "import type { CompactJsonSchema } from '../json-decoder.js';",
    '',
    ...schemaEntries.flatMap(([name, schema]) => [
      `const ${name}SchemaJson =`,
      `  ${quoteJson(schema)};`,
    ]),
    'const apiErrorCodesJson =',
    `  ${quoteJson(errorCodes)};`,
    '',
    ...schemaEntries.flatMap(([name]) => [
      `export const ${name}JsonSchema = JSON.parse(`,
      `  ${name}SchemaJson,`,
      ') as CompactJsonSchema;',
    ]),
    'export const generatedApiErrorCodes = JSON.parse(apiErrorCodesJson) as readonly string[];',
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
