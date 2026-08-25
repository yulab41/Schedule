const ignoredSchemaKeys = new Set(['$schema', 'readOnly']);
const supportedSchemaKeys = new Set([
  'additionalProperties',
  'const',
  'enum',
  'exclusiveMaximum',
  'exclusiveMinimum',
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
  'propertyNames',
  'properties',
  'required',
  'type',
]);
const supportedSchemaTypes = new Set(['array', 'boolean', 'integer', 'number', 'object', 'string']);

export function sanitizeJsonSchema(schema, path = '$') {
  if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) {
    throw new Error(`${path} must be a JSON schema object`);
  }
  // Zod's `unrepresentable: any` emits `{}` for recursive JsonObject/custom
  // payloads.  Those contracts explicitly require an object, so keep the
  // compact decoder strict at the container boundary while accepting the
  // server-owned object contents without pretending to know their shape.
  if (schema.type === undefined && Object.keys(schema).length === 0) {
    return { type: 'object' };
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
    if (schema.additionalProperties === false) {
      result.additionalProperties = false;
    } else if (
      schema.additionalProperties !== null &&
      typeof schema.additionalProperties === 'object' &&
      !Array.isArray(schema.additionalProperties)
    ) {
      result.additionalProperties = sanitizeJsonSchema(
        schema.additionalProperties,
        `${path}.additionalProperties`,
      );
    } else {
      throw new Error(`${path}.additionalProperties must be false or a typed schema`);
    }
  }
  if (schema.propertyNames !== undefined) {
    result.propertyNames = sanitizeJsonSchema(schema.propertyNames, `${path}.propertyNames`);
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
  if (schema.exclusiveMinimum !== undefined) {
    if (schema.type !== 'integer' || !Number.isInteger(schema.exclusiveMinimum)) {
      throw new Error(`${path}.exclusiveMinimum is only supported for integer schemas`);
    }
    result.minimum = schema.exclusiveMinimum + 1;
  }
  if (schema.exclusiveMaximum !== undefined) {
    if (schema.type !== 'integer' || !Number.isInteger(schema.exclusiveMaximum)) {
      throw new Error(`${path}.exclusiveMaximum is only supported for integer schemas`);
    }
    result.maximum = schema.exclusiveMaximum - 1;
  }
  if (schema.format !== undefined) {
    if (schema.format !== 'date' && schema.format !== 'date-time' && schema.format !== 'uuid') {
      throw new Error(`${path}.format must be date, date-time or uuid`);
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

export function sanitizeStatisticsSchema(schema, path = '$') {
  const sanitized = sanitizeJsonSchema(schema, path);
  const summaries = [
    sanitized.properties?.summary,
    sanitized.properties?.months?.items?.properties?.summary,
  ];
  for (const summary of summaries) {
    const members = summary?.properties?.members?.items;
    if (members?.properties?.actualVsPlanned !== undefined) {
      members.properties.actualVsPlanned = { type: 'array', items: { type: 'object' } };
    }
  }
  return sanitized;
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
