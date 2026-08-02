import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import type { HolidayImportInput } from '@schedule/contracts';
import {
  createDatabaseClient,
  holidayCalendarVersions,
  holidayDates,
  withTransaction,
} from '@schedule/database';
import { and, desc, eq, isNull } from 'drizzle-orm';

const minimumYear = 1900;
const maximumYear = 2100;
const maximumImportDates = 400;

const args = parseArgs(process.argv.slice(2));
if (args.file === undefined || args.year === undefined) {
  console.error(
    'Usage: node infra/scripts/dist/import-holidays.js --file=holidays-2026.json --year=2026',
  );
  process.exit(1);
}

const rawInput = readJsonFile(args.file);
const input: HolidayImportInput = {
  dates: Array.isArray(rawInput)
    ? (rawInput as HolidayImportInput['dates'])
    : ((rawInput as { dates?: unknown }).dates as HolidayImportInput['dates']),
  year: args.year,
};
const entries = validateImportInput(input);

const database = createDatabaseClient({
  database: readRequired('MYSQL_DATABASE'),
  host: process.env.MYSQL_HOST ?? '127.0.0.1',
  password: readRequired('MYSQL_PASSWORD'),
  port: Number(process.env.MYSQL_PORT ?? '3306'),
  user: readRequired('MYSQL_USER'),
});

try {
  const result = await withTransaction(database, async (transaction) => {
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
    return { calendarVersionId, dateCount: entries.length, nextVersion };
  });

  console.log(
    JSON.stringify({
      calendarVersionId: result.calendarVersionId,
      dateCount: result.dateCount,
      status: 'draft',
      version: result.nextVersion,
      year: input.year,
      next: 'Confirm the draft through the authenticated platform-admin API before calendar and statistics read it.',
    }),
  );
} finally {
  await database.close();
}

function validateImportInput(input: HolidayImportInput): readonly NormalizedHolidayEntry[] {
  const year = input.year;
  if (!Number.isInteger(year) || year < minimumYear || year > maximumYear) {
    throw new Error(`Year must be an integer from ${minimumYear} to ${maximumYear}.`);
  }
  if (
    !Array.isArray(input.dates) ||
    input.dates.length === 0 ||
    input.dates.length > maximumImportDates
  ) {
    throw new Error(`The import must contain 1 to ${maximumImportDates} dates.`);
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
      throw new Error(`Date ${String(entry.date)} is invalid or does not belong to ${year}.`);
    }
    if (seenDates.has(entry.date)) {
      throw new Error(`Date ${entry.date} is duplicated.`);
    }
    if (holidayName.length === 0 || holidayName.length > 100) {
      throw new Error('The holiday name must be 1 to 100 characters.');
    }
    const isOffDay = entry.isOffDay === true;
    const isWorkday = entry.isWorkday === true;
    if (isOffDay === isWorkday) {
      throw new Error(`Date ${entry.date} must be marked as either an off day or a workday.`);
    }
    seenDates.add(entry.date);
    return { date: entry.date, holidayName, isOffDay, isWorkday };
  });
}

function readJsonFile(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    console.error(`Unable to read ${path}: ${getErrorMessage(error)}`);
    process.exit(1);
  }
}

function readRequired(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    console.error(`Missing required environment variable ${name}.`);
    process.exit(1);
  }
  return value;
}

function parseArgs(values: readonly string[]): {
  readonly file?: string;
  readonly year?: number;
} {
  const result: { file?: string; year?: number } = {};
  for (const value of values) {
    if (value.startsWith('--file=')) {
      result.file = value.slice('--file='.length);
    }
    if (value.startsWith('--year=')) {
      result.year = Number(value.slice('--year='.length));
    }
  }
  return result;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.length > 0 ? error.message : String(error);
}

interface NormalizedHolidayEntry {
  readonly date: string;
  readonly holidayName: string;
  readonly isOffDay: boolean;
  readonly isWorkday: boolean;
}
