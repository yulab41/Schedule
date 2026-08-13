import { INVALID_RESPONSE, type DecodeResult } from './types.js';

export type UnknownRecord = Record<string, unknown>;
export type Mutable<Value> = { -readonly [Key in keyof Value]: Value[Key] };

export function isObjectRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function hasOnlyEnumerableKeys(
  value: UnknownRecord,
  allowedKeys: ReadonlySet<string>,
): boolean {
  for (const key in value) {
    if (!allowedKeys.has(key)) return false;
  }
  return true;
}

export function decodeReadonlyArray<Item>(
  value: unknown,
  decodeItem: (item: unknown) => Item | undefined,
): readonly Item[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const length = value.length;
  const decoded = new Array<Item>(length);
  for (let index = 0; index < length; index += 1) {
    const item: unknown = value[index];
    const decodedItem = decodeItem(item);
    if (decodedItem === undefined) return undefined;
    decoded[index] = decodedItem;
  }
  return Object.freeze(decoded);
}

export function decodeResult<Value>(decode: () => Value | undefined): DecodeResult<Value> {
  try {
    const value = decode();
    return value === undefined
      ? { error: { code: INVALID_RESPONSE }, ok: false }
      : { ok: true, value };
  } catch {
    return { error: { code: INVALID_RESPONSE }, ok: false };
  }
}
