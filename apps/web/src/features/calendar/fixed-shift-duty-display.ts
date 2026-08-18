import type { CalendarDutyAssignment } from '@schedule/contracts';
import { formatChinaStandardTime } from '@schedule/scheduling-domain';

export type FixedShiftDutyTone = 'active' | 'break' | 'on-call';

export interface FixedShiftDutyDisplay {
  readonly currentPhase?: {
    readonly label: string;
    readonly tone: FixedShiftDutyTone;
  };
  readonly description: string;
}

interface FixedShiftProfile {
  readonly abbreviation: string;
  readonly description: string;
  readonly durationMinutes: number;
  readonly endTime: string;
  readonly phases: readonly {
    readonly endMinute: number;
    readonly label: string;
    readonly startMinute: number;
    readonly tone: FixedShiftDutyTone;
  }[];
  readonly startTime: string;
}

const fixedShiftProfiles: readonly FixedShiftProfile[] = [
  {
    abbreviation: 'D',
    description: '工作 08:00–12:00、14:30–17:30｜12:00–14:30 午间间休',
    durationMinutes: 9.5 * 60,
    endTime: '17:30',
    phases: [
      { endMinute: 4 * 60, label: '在岗中', startMinute: 0, tone: 'active' },
      { endMinute: 6.5 * 60, label: '午间间休', startMinute: 4 * 60, tone: 'break' },
      { endMinute: 9.5 * 60, label: '在岗中', startMinute: 6.5 * 60, tone: 'active' },
    ],
    startTime: '08:00',
  },
  {
    abbreviation: 'NP',
    description: '工作 17:30–22:00、次日07:00–11:00｜22:00–次日07:00 值班房听班',
    durationMinutes: 17.5 * 60,
    endTime: '11:00',
    phases: [
      { endMinute: 4.5 * 60, label: '在岗中', startMinute: 0, tone: 'active' },
      {
        endMinute: 13.5 * 60,
        label: '值班房听班中',
        startMinute: 4.5 * 60,
        tone: 'on-call',
      },
      { endMinute: 17.5 * 60, label: '在岗中', startMinute: 13.5 * 60, tone: 'active' },
    ],
    startTime: '17:30',
  },
];

export function getFixedShiftDutyDisplay(
  assignment: CalendarDutyAssignment,
  now: Date = new Date(),
): FixedShiftDutyDisplay | undefined {
  const startsAt = Date.parse(assignment.startsAt);
  const endsAt = Date.parse(assignment.endsAt);
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) {
    return undefined;
  }

  const abbreviation = assignment.shiftTypeAbbreviation.trim().toUpperCase();
  const durationMinutes = (endsAt - startsAt) / 60_000;
  const profile = fixedShiftProfiles.find(
    (candidate) =>
      candidate.abbreviation === abbreviation &&
      candidate.durationMinutes === durationMinutes &&
      candidate.startTime === formatChinaStandardTime(startsAt) &&
      candidate.endTime === formatChinaStandardTime(endsAt),
  );
  if (profile === undefined) {
    return undefined;
  }

  const elapsedMinutes = (now.getTime() - startsAt) / 60_000;
  const currentPhase = profile.phases.find(
    (phase) => elapsedMinutes >= phase.startMinute && elapsedMinutes < phase.endMinute,
  );

  return {
    ...(currentPhase === undefined
      ? {}
      : { currentPhase: { label: currentPhase.label, tone: currentPhase.tone } }),
    description: profile.description,
  };
}
