import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { canConfirmSchedulePeriodMutation } from '@schedule/presentation-core';
import { describe, expect, it } from 'vitest';

describe('schedule publication confirmation regression', () => {
  it('allows a current-month withdrawal after the visible impact acknowledgement', () => {
    expect(
      canConfirmSchedulePeriodMutation(
        confirmationInput({
          acknowledgePastDates: true,
          acknowledgeWorkflowRevocations: false,
          action: 'withdraw',
        }),
      ),
    ).toBe(false);
    expect(
      canConfirmSchedulePeriodMutation(
        confirmationInput({
          acknowledgePastDates: false,
          acknowledgeWorkflowRevocations: true,
          action: 'withdraw',
        }),
      ),
    ).toBe(true);
  });

  it('keeps the separate past-date acknowledgement mandatory for republishing', () => {
    expect(
      canConfirmSchedulePeriodMutation(
        confirmationInput({
          acknowledgePastDates: false,
          acknowledgeWorkflowRevocations: true,
          action: 'publish',
        }),
      ),
    ).toBe(false);
  });

  it('scopes the Vue disabled condition to the republish action', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../../views/schedules/ManualScheduleView.vue', import.meta.url)),
      'utf8',
    );

    expect(source).toMatch(
      /periodMutationAction === 'publish'\s*&&\s*periodMutationHasPastDates\s*&&\s*!acknowledgePastDates/u,
    );
  });
});

function confirmationInput(input: {
  readonly acknowledgePastDates: boolean;
  readonly acknowledgeWorkflowRevocations: boolean;
  readonly action: 'publish' | 'withdraw';
}): Parameters<typeof canConfirmSchedulePeriodMutation>[0] {
  return {
    ...input,
    hasPastDates: true,
    hasTarget: true,
    requiresAcknowledgement: true,
  };
}
