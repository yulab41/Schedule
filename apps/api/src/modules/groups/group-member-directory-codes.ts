import {
  type DatabaseTransaction,
  directoryContactMethods,
  directoryEntries,
  directoryImportBatches,
} from '@schedule/database';
import { and, eq, inArray } from 'drizzle-orm';

interface PublicMember {
  readonly membershipId: string;
  readonly realName: string;
  readonly mobilePhone: string | undefined;
}

interface DirectoryIdentity {
  readonly realName: string | null;
  readonly mobilePhone: string | null;
  readonly employeeCode: string | null;
}

export function completePublicPhone(value: string | undefined): string | undefined {
  if (value === undefined || !/^[+\d\s()-]+$/u.test(value)) return undefined;
  const normalized = value.trim().replace(/[\s()-]/gu, '');
  return /^\+?\d{8,15}$/u.test(normalized) ? normalized : undefined;
}

export function resolveUniqueEmployeeCodes(
  member: PublicMember,
  rows: readonly DirectoryIdentity[],
): readonly string[] | undefined {
  const phone = completePublicPhone(member.mobilePhone);
  if (phone === undefined) return undefined;
  const matches = rows.filter(
    (row) => row.realName === member.realName && row.mobilePhone === phone,
  );
  if (matches.length === 0 || matches.some((row) => !row.employeeCode?.trim())) return undefined;
  const codes = [...new Set(matches.map((row) => row.employeeCode!.trim()))];
  return codes.length === 1 ? codes : undefined;
}

// Read only already-disclosed full numbers; never match a masked/hidden number or a name alone.
export async function readMemberEmployeeCodes(
  transaction: DatabaseTransaction,
  members: readonly PublicMember[],
  canViewAdministratorEntries: boolean,
): Promise<ReadonlyMap<string, readonly string[]>> {
  const numbers = [
    ...new Set(
      members.flatMap((member) => {
        const phone = completePublicPhone(member.mobilePhone);
        return phone === undefined ? [] : [phone];
      }),
    ),
  ];
  if (numbers.length === 0) return new Map();
  const rows = await transaction
    .select({
      realName: directoryEntries.contactName,
      employeeCode: directoryEntries.employeeCode,
      mobilePhone: directoryContactMethods.normalizedFullNumber,
    })
    .from(directoryEntries)
    .innerJoin(directoryImportBatches, eq(directoryImportBatches.id, directoryEntries.batchId))
    .innerJoin(directoryContactMethods, eq(directoryContactMethods.entryId, directoryEntries.id))
    .where(
      and(
        eq(directoryImportBatches.directoryKind, 'employee'),
        eq(directoryImportBatches.status, 'published'),
        eq(directoryEntries.entryKind, 'person'),
        inArray(directoryContactMethods.normalizedFullNumber, numbers),
        ...(canViewAdministratorEntries ? [] : [eq(directoryEntries.visibility, 'member')]),
      ),
    );
  return new Map(
    members.flatMap((member) => {
      const codes = resolveUniqueEmployeeCodes(member, rows);
      return codes === undefined ? [] : [[member.membershipId, codes] as const];
    }),
  );
}
