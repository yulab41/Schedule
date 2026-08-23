export interface CompactJsonSchema {
  readonly additionalProperties?: false | undefined;
  readonly const?: boolean | number | string | undefined;
  readonly enum?: readonly string[] | undefined;
  readonly items?: CompactJsonSchema | undefined;
  readonly maxItems?: number | undefined;
  readonly maximum?: number | undefined;
  readonly minItems?: number | undefined;
  readonly minLength?: number | undefined;
  readonly minimum?: number | undefined;
  readonly pattern?: string | undefined;
  readonly properties?: Readonly<Record<string, CompactJsonSchema>> | undefined;
  readonly required?: readonly string[] | undefined;
  readonly type: 'array' | 'boolean' | 'integer' | 'number' | 'object' | 'string';
}

export type CompactDecodeResult<Output> =
  { readonly data: Output; readonly success: true } | { readonly success: false };

export interface CompactDecoder<Output> {
  safeDecode(value: unknown): CompactDecodeResult<Output>;
}

type Validator = (value: unknown) => boolean;

const hasOwnProperty = Object.prototype.hasOwnProperty;

export function createCompactDecoder<Output>(schema: CompactJsonSchema): CompactDecoder<Output> {
  const validate = compileSchema(schema);
  return {
    safeDecode(value) {
      return validate(value) ? { data: value as Output, success: true } : { success: false };
    },
  };
}

function compileSchema(schema: CompactJsonSchema): Validator {
  switch (schema.type) {
    case 'array': {
      if (schema.items === undefined) {
        throw new Error('Compact array schemas require an items decoder.');
      }
      const validateItem = compileSchema(schema.items);
      return (value) =>
        Array.isArray(value) &&
        (schema.minItems === undefined || value.length >= schema.minItems) &&
        (schema.maxItems === undefined || value.length <= schema.maxItems) &&
        value.every((item) => validateItem(item));
    }
    case 'boolean':
      return (value) =>
        typeof value === 'boolean' &&
        (schema.const === undefined || Object.is(value, schema.const));
    case 'integer':
      return compileNumberSchema(schema, true);
    case 'number':
      return compileNumberSchema(schema, false);
    case 'object':
      return compileObjectSchema(schema);
    case 'string':
      return compileStringSchema(schema);
  }
}

function compileNumberSchema(schema: CompactJsonSchema, integerOnly: boolean): Validator {
  return (value) =>
    typeof value === 'number' &&
    Number.isFinite(value) &&
    (!integerOnly || Number.isInteger(value)) &&
    (schema.const === undefined || Object.is(value, schema.const)) &&
    (schema.minimum === undefined || value >= schema.minimum) &&
    (schema.maximum === undefined || value <= schema.maximum);
}

function compileObjectSchema(schema: CompactJsonSchema): Validator {
  const properties = schema.properties ?? {};
  const validators = new Map(
    Object.entries(properties).map(([name, propertySchema]) => [
      name,
      compileSchema(propertySchema),
    ]),
  );
  const required = new Set(schema.required ?? []);

  return (value) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }
    const record = value as Readonly<Record<string, unknown>>;
    for (const name of required) {
      const validator = validators.get(name);
      if (
        validator === undefined ||
        !hasOwnProperty.call(record, name) ||
        !validator(record[name])
      ) {
        return false;
      }
    }
    for (const name of Object.keys(record)) {
      const validator = validators.get(name);
      if (validator === undefined) {
        if (schema.additionalProperties === false) return false;
        continue;
      }
      if (!required.has(name) && record[name] === undefined) {
        continue;
      }
      if (!validator(record[name])) return false;
    }
    return true;
  };
}

function compileStringSchema(schema: CompactJsonSchema): Validator {
  const allowedValues = schema.enum === undefined ? undefined : new Set(schema.enum);
  const pattern = schema.pattern === undefined ? undefined : new RegExp(schema.pattern, 'u');
  return (value) =>
    typeof value === 'string' &&
    (schema.minLength === undefined || value.length >= schema.minLength) &&
    (schema.const === undefined || Object.is(value, schema.const)) &&
    (allowedValues === undefined || allowedValues.has(value)) &&
    (pattern === undefined || pattern.test(value));
}
