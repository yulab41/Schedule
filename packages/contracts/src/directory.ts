import { z } from 'zod';

export const directoryEntryKindSchema = z.enum([
  'department',
  'person',
  'service',
  'facility',
  'vendor',
  'emergency',
  'switchboard',
  'other',
]);
export type DirectoryEntryKind = z.infer<typeof directoryEntryKindSchema>;

export const directoryEntryKindLabels: Readonly<Record<DirectoryEntryKind, string>> = {
  department: '科室',
  emergency: '急救',
  facility: '设施',
  other: '其他',
  person: '人员',
  service: '服务点',
  switchboard: '总机',
  vendor: '外部服务',
};

export const directoryContactTypeSchema = z.enum([
  'voice',
  'mobile',
  'fax',
  'emergency',
  'hotline',
  'other',
]);
export type DirectoryContactType = z.infer<typeof directoryContactTypeSchema>;

const trimmedFilter = (maximumLength: number) =>
  z.string().trim().min(1).max(maximumLength).optional();

export const directoryQuerySchema = z
  .object({
    building: trimmedFilter(100),
    campusCode: trimmedFilter(64),
    cursor: z.string().min(1).max(2048).optional(),
    department: trimmedFilter(150),
    entryKind: directoryEntryKindSchema.optional(),
    floor: trimmedFilter(64),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
    q: trimmedFilter(100),
    section: trimmedFilter(100),
    subunit: trimmedFilter(150),
  })
  .strict();
export type DirectoryQuery = z.infer<typeof directoryQuerySchema>;

const directoryCampusSchema = z
  .object({
    code: z.string().min(1).max(64),
    dialingNote: z.string().min(1).max(1000).optional(),
    name: z.string().min(1).max(100),
  })
  .strict();
export type DirectoryCampus = z.infer<typeof directoryCampusSchema>;

const fullNumberSchema = z
  .string()
  .min(3)
  .max(64)
  .refine((value) => {
    const digitCount = value.replaceAll(/\D/gu, '').length;
    return digitCount >= 3 && digitCount <= 20;
  });

export const directoryContactMethodSchema = z
  .object({
    displayOrder: z.number().int().nonnegative(),
    fullNumber: fullNumberSchema.optional(),
    id: z.string().uuid(),
    internalExtension: z
      .string()
      .regex(/^\d{3,6}$/u)
      .optional(),
    isPrimary: z.boolean(),
    label: z.string().min(1).max(100).optional(),
    type: directoryContactTypeSchema,
  })
  .strict()
  .refine(
    (contact) => contact.fullNumber !== undefined || contact.internalExtension !== undefined,
    { message: 'A directory contact method must contain at least one number.' },
  );
export type DirectoryContactMethod = z.infer<typeof directoryContactMethodSchema>;

export const directoryEntrySchema = z
  .object({
    building: z.string().min(1).max(100).optional(),
    campus: directoryCampusSchema,
    contactName: z.string().min(1).max(150).optional(),
    contacts: z.readonly(z.array(directoryContactMethodSchema).max(50)),
    department: z.string().min(1).max(150).optional(),
    displayOrder: z.number().int().nonnegative(),
    entryKind: directoryEntryKindSchema,
    floor: z.string().min(1).max(64).optional(),
    id: z.string().uuid(),
    notes: z.string().min(1).max(1000).optional(),
    room: z.string().min(1).max(100).optional(),
    section: z.string().min(1).max(100).optional(),
    subunit: z.string().min(1).max(150).optional(),
  })
  .strict();
export type DirectoryEntry = z.infer<typeof directoryEntrySchema>;

export const directoryPageSchema = z
  .object({
    entries: z.readonly(z.array(directoryEntrySchema)),
    nextCursor: z.string().min(1).max(2048).optional(),
    totalCount: z.number().int().nonnegative(),
  })
  .strict();
export type DirectoryPage = z.infer<typeof directoryPageSchema>;

export const directoryFacetOptionSchema = z
  .object({
    count: z.number().int().nonnegative(),
    label: z.string().min(1).max(150),
    value: z.string().min(1).max(150),
  })
  .strict();
export type DirectoryFacetOption = z.infer<typeof directoryFacetOptionSchema>;

export const directoryFacetSnapshotSchema = z
  .object({
    buildings: z.readonly(z.array(directoryFacetOptionSchema)),
    campuses: z.readonly(z.array(directoryFacetOptionSchema)),
    departments: z.readonly(z.array(directoryFacetOptionSchema)),
    entryKinds: z.readonly(
      z.array(
        directoryFacetOptionSchema.extend({
          value: directoryEntryKindSchema,
        }),
      ),
    ),
    floors: z.readonly(z.array(directoryFacetOptionSchema)),
    publishedEffectiveOn: z.iso.date(),
    publishedImportVersion: z.string().min(1).max(64),
    sections: z.readonly(z.array(directoryFacetOptionSchema)),
    subunits: z.readonly(z.array(directoryFacetOptionSchema)),
    totalCount: z.number().int().nonnegative(),
  })
  .strict();
export type DirectoryFacetSnapshot = z.infer<typeof directoryFacetSnapshotSchema>;
