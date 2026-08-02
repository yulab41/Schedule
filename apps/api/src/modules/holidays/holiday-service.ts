import { randomUUID } from 'node:crypto';

import type {
  ConfirmedHolidayDate,
  HolidayCalendarVersion,
  HolidayCoverage,
  HolidayImportDiffEntry,
  HolidayImportInput,
  HolidayImportPreview,
  HolidayImportResult,
  HolidayReadModel,
} from '@schedule/contracts';
import type { DatabaseClient, DatabaseTransaction } from '@schedule/database';
import { holidayCalendarVersions, holidayDates, withTransaction } from '@schedule/database';
import { getChinaStandardTimeBusinessDate } from '@schedule/scheduling-domain';
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { AuditWriter } from '../audit/audit-writer.js';
import { requireActiveUser } from '../notifications/active-user.js';
import { requireHolidayAdmin } from './holiday-admin.js';

const minimumYear = 1900;
const maximumYear = 2100;
const maximumImportDates = 400;

interface ConfirmedCalendar {
  readonly dates: readonly (typeof holidayDates.$inferSelect)[];
  readonly id: string;
  readonly version: number;
}

export class HolidayService {
  private readonly auditWriter = new AuditWriter();

  public constructor(
    private readonly databaseClient: DatabaseClient,
    private readonly allowedCloudbaseUids: ReadonlySet<string>,
  ) {}

  public async previewImport(
    identity: AuthenticatedIdentity,
    input: HolidayImportInput,
  ): Promise<HolidayImportPreview> {
    return withTransaction(this.databaseClient, async (transaction) => {
      await requireHolidayAdmin(transaction, identity, this.allowedCloudbaseUids);
      const entries = validateImportInput(input);
      const confirmed = await this.loadLatestConfirmed(transaction, input.year);
      const confirmedByDate = new Map(confirmed?.dates.map((row) => [row.calendarDate, row]) ?? []);

      const diffEntries: HolidayImportDiffEntry[] = [];
      for (const entry of entries) {
        const confirmedRow = confirmedByDate.get(entry.date);
        const change =
          confirmedRow === undefined
            ? 'added'
            : confirmedRow.holidayName === entry.holidayName &&
                confirmedRow.isOffDay === (entry.isOffDay ? 1 : 0) &&
                confirmedRow.isWorkday === (entry.isWorkday ? 1 : 0)
              ? 'unchanged'
              : 'changed';
        diffEntries.push({ change, ...entry });
      }
      if (confirmed !== undefined) {
        for (const row of [...confirmed.dates].sort((first, second) =>
          first.calendarDate.localeCompare(second.calendarDate),
        )) {
          if (entries.some((entry) => entry.date === row.calendarDate)) {
            continue;
          }
          diffEntries.push({
            change: 'removed',
            date: row.calendarDate,
            holidayName: row.holidayName,
            isOffDay: row.isOffDay === 1,
            isWorkday: row.isWorkday === 1,
          });
        }
      }
      diffEntries.sort((first, second) => first.date.localeCompare(second.date));

      return {
        addedCount: diffEntries.filter((entry) => entry.change === 'added').length,
        changedCount: diffEntries.filter((entry) => entry.change === 'changed').length,
        entries: diffEntries,
        ...(confirmed === undefined ? {} : { latestConfirmedVersion: confirmed.version }),
        removedCount: diffEntries.filter((entry) => entry.change === 'removed').length,
        unchangedCount: diffEntries.filter((entry) => entry.change === 'unchanged').length,
        year: input.year,
      };
    });
  }

  public async importCalendar(
    identity: AuthenticatedIdentity,
    input: HolidayImportInput,
  ): Promise<HolidayImportResult> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const actorUserId = await requireHolidayAdmin(
        transaction,
        identity,
        this.allowedCloudbaseUids,
      );
      const entries = validateImportInput(input);
      const [latest] = await transaction
        .select({ version: holidayCalendarVersions.version })
        .from(holidayCalendarVersions)
        .where(
          and(
            eq(holidayCalendarVersions.year, input.year),
            isNull(holidayCalendarVersions.deletedAt),
          ),
        )
        .orderBy(desc(holidayCalendarVersions.version))
        .limit(1);
      const nextVersion = (latest?.version ?? 0) + 1;
      const calendarVersionId = randomUUID();
      await transaction.insert(holidayCalendarVersions).values({
        createdByUserId: actorUserId,
        id: calendarVersionId,
        status: 'draft',
        version: nextVersion,
        year: input.year,
      });
      for (const entry of entries) {
        await transaction.insert(holidayDates).values({
          calendarDate: entry.date,
          calendarVersionId,
          holidayName: entry.holidayName,
          id: randomUUID(),
          isOffDay: entry.isOffDay ? 1 : 0,
          isWorkday: entry.isWorkday ? 1 : 0,
        });
      }
      await this.auditWriter.append(transaction, {
        action: 'holiday_calendar_import',
        actorUserId,
        metadata: {
          dateCount: entries.length,
          version: nextVersion,
          year: input.year,
        },
        operationId: randomUUID(),
        outcome: 'completed',
        targetId: calendarVersionId,
        targetType: 'holiday_calendar_version',
      });

      return {
        calendarVersionId,
        dateCount: entries.length,
        status: 'draft',
        version: nextVersion,
        year: input.year,
      };
    });
  }

  public async confirmVersion(
    identity: AuthenticatedIdentity,
    calendarVersionId: string,
  ): Promise<HolidayCalendarVersion> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const actorUserId = await requireHolidayAdmin(
        transaction,
        identity,
        this.allowedCloudbaseUids,
      );
      const [version] = await transaction
        .select()
        .from(holidayCalendarVersions)
        .where(
          and(
            eq(holidayCalendarVersions.id, calendarVersionId),
            isNull(holidayCalendarVersions.deletedAt),
          ),
        )
        .limit(1)
        .for('update');
      if (version === undefined) {
        throw new ApiError({
          code: 'NOT_FOUND',
          statusCode: 404,
          userMessage: '节假日版本不存在。',
        });
      }
      if (version.status === 'confirmed') {
        throw new ApiError({
          code: 'CONFLICT',
          latestData: {
            id: version.id,
            objectType: 'holiday_calendar_version',
            status: version.status,
            version: version.version,
          },
          statusCode: 409,
          userMessage: '该节假日版本已确认，不能重复确认。',
        });
      }

      await transaction
        .update(holidayCalendarVersions)
        .set({ confirmedAt: new Date(), status: 'confirmed' })
        .where(eq(holidayCalendarVersions.id, calendarVersionId));
      await this.auditWriter.append(transaction, {
        action: 'holiday_calendar_confirm',
        actorUserId,
        metadata: {
          version: version.version,
          year: version.year,
        },
        operationId: randomUUID(),
        outcome: 'completed',
        targetId: calendarVersionId,
        targetType: 'holiday_calendar_version',
      });

      return this.readVersion(transaction, calendarVersionId);
    });
  }

  public async listVersions(
    identity: AuthenticatedIdentity,
    year: number | undefined,
  ): Promise<readonly HolidayCalendarVersion[]> {
    return withTransaction(this.databaseClient, async (transaction) => {
      await requireHolidayAdmin(transaction, identity, this.allowedCloudbaseUids);
      const rows = await transaction
        .select()
        .from(holidayCalendarVersions)
        .where(
          year === undefined
            ? isNull(holidayCalendarVersions.deletedAt)
            : and(
                eq(holidayCalendarVersions.year, year),
                isNull(holidayCalendarVersions.deletedAt),
              ),
        )
        .orderBy(asc(holidayCalendarVersions.year), desc(holidayCalendarVersions.version));
      if (rows.length === 0) {
        return [];
      }
      const dates = await transaction
        .select()
        .from(holidayDates)
        .where(
          inArray(
            holidayDates.calendarVersionId,
            rows.map((row) => row.id),
          ),
        );
      const countByVersion = new Map<string, number>();
      for (const date of dates) {
        countByVersion.set(
          date.calendarVersionId,
          (countByVersion.get(date.calendarVersionId) ?? 0) + 1,
        );
      }

      return rows.map((row) => toVersionSummary(row, countByVersion.get(row.id) ?? 0));
    });
  }

  public async getConfirmed(
    identity: AuthenticatedIdentity,
    year: number,
  ): Promise<HolidayReadModel> {
    return withTransaction(this.databaseClient, async (transaction) => {
      await requireActiveUser(transaction, identity);
      const confirmed = await this.loadLatestConfirmed(transaction, year);
      if (confirmed === undefined) {
        return { confirmed: false, dates: [], year };
      }

      return {
        confirmed: true,
        dates: confirmed.dates
          .map(toConfirmedHolidayDate)
          .sort((first, second) => first.date.localeCompare(second.date)),
        year,
      };
    });
  }

  public async getCoverage(
    identity: AuthenticatedIdentity,
    now = new Date(),
  ): Promise<HolidayCoverage> {
    return withTransaction(this.databaseClient, async (transaction) => {
      await requireHolidayAdmin(transaction, identity, this.allowedCloudbaseUids);
      const rows = await transaction
        .selectDistinct({ year: holidayCalendarVersions.year })
        .from(holidayCalendarVersions)
        .where(
          and(
            eq(holidayCalendarVersions.status, 'confirmed'),
            isNull(holidayCalendarVersions.deletedAt),
          ),
        );
      const confirmedYears = rows.map((row) => row.year).sort((first, second) => first - second);
      const nextYear = Number(getChinaStandardTimeBusinessDate(now).slice(0, 4)) + 1;

      return {
        confirmedYears,
        missingNextYear: !confirmedYears.includes(nextYear),
        nextYear,
      };
    });
  }

  private async loadLatestConfirmed(
    transaction: DatabaseTransaction,
    year: number,
  ): Promise<ConfirmedCalendar | undefined> {
    const [version] = await transaction
      .select()
      .from(holidayCalendarVersions)
      .where(
        and(
          eq(holidayCalendarVersions.year, year),
          eq(holidayCalendarVersions.status, 'confirmed'),
          isNull(holidayCalendarVersions.deletedAt),
        ),
      )
      .orderBy(desc(holidayCalendarVersions.version))
      .limit(1);
    if (version === undefined) {
      return undefined;
    }

    const dates = await transaction
      .select()
      .from(holidayDates)
      .where(eq(holidayDates.calendarVersionId, version.id));

    return { dates, id: version.id, version: version.version };
  }

  private async readVersion(
    transaction: DatabaseTransaction,
    calendarVersionId: string,
  ): Promise<HolidayCalendarVersion> {
    const [version] = await transaction
      .select()
      .from(holidayCalendarVersions)
      .where(
        and(
          eq(holidayCalendarVersions.id, calendarVersionId),
          isNull(holidayCalendarVersions.deletedAt),
        ),
      )
      .limit(1);
    if (version === undefined) {
      throw new ApiError({
        code: 'NOT_FOUND',
        statusCode: 404,
        userMessage: '节假日版本不存在。',
      });
    }
    const dates = await transaction
      .select({ id: holidayDates.id })
      .from(holidayDates)
      .where(eq(holidayDates.calendarVersionId, calendarVersionId));

    return toVersionSummary(version, dates.length);
  }
}

function validateImportInput(input: HolidayImportInput): readonly NormalizedHolidayEntry[] {
  const year = input.year;
  if (!Number.isInteger(year) || year < minimumYear || year > maximumYear) {
    throw validationError(`年份必须是 ${minimumYear} 到 ${maximumYear} 之间的整数。`);
  }
  if (
    !Array.isArray(input.dates) ||
    input.dates.length === 0 ||
    input.dates.length > maximumImportDates
  ) {
    throw validationError(`节假日日期必须是 1 到 ${maximumImportDates} 条。`);
  }

  const seenDates = new Set<string>();
  return input.dates.map((entry) => {
    const holidayName = typeof entry.holidayName === 'string' ? entry.holidayName.trim() : '';
    const parsedDate = new Date(`${entry.date}T00:00:00.000Z`);
    const dateIsValid =
      typeof entry.date === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/u.test(entry.date) &&
      entry.date.slice(0, 4) === String(year) &&
      !Number.isNaN(parsedDate.valueOf()) &&
      parsedDate.toISOString().slice(0, 10) === entry.date;
    if (!dateIsValid) {
      throw validationError(`日期 ${String(entry.date)} 无效或不属于 ${year} 年。`);
    }
    if (seenDates.has(entry.date)) {
      throw validationError(`日期 ${entry.date} 重复。`);
    }
    if (holidayName.length === 0 || holidayName.length > 100) {
      throw validationError('节日名称必须是 1 到 100 个字符。');
    }
    const isOffDay = entry.isOffDay === true;
    const isWorkday = entry.isWorkday === true;
    if (isOffDay === isWorkday) {
      throw validationError(`日期 ${entry.date} 必须且只能标记为放假或调休工作日之一。`);
    }
    seenDates.add(entry.date);
    return { date: entry.date, holidayName, isOffDay, isWorkday };
  });
}

function toVersionSummary(
  row: typeof holidayCalendarVersions.$inferSelect,
  dateCount: number,
): HolidayCalendarVersion {
  return {
    ...(row.confirmedAt === null ? {} : { confirmedAt: row.confirmedAt.toISOString() }),
    createdAt: row.createdAt.toISOString(),
    dateCount,
    id: row.id,
    status: row.status,
    version: row.version,
    year: row.year,
  };
}

function toConfirmedHolidayDate(row: typeof holidayDates.$inferSelect): ConfirmedHolidayDate {
  return {
    date: row.calendarDate,
    holidayName: row.holidayName,
    isOffDay: row.isOffDay === 1,
    isWorkday: row.isWorkday === 1,
  };
}

function validationError(userMessage: string): ApiError {
  return new ApiError({
    code: 'VALIDATION_FAILED',
    statusCode: 400,
    userMessage,
  });
}

interface NormalizedHolidayEntry {
  readonly date: string;
  readonly holidayName: string;
  readonly isOffDay: boolean;
  readonly isWorkday: boolean;
}
