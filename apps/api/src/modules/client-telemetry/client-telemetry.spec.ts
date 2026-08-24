import { describe, expect, it } from 'vitest';

import { ClientTelemetryBudget } from './client-telemetry-service.js';

describe('client telemetry global budget', () => {
  it('bounds anonymous events per fixed minute without retaining an IP', () => {
    const budget = new ClientTelemetryBudget({ maxEventsPerMinute: 3 });
    const now = new Date('2026-08-24T00:00:00.000Z');

    expect(() => budget.consume(2, now)).not.toThrow();
    expect(() => budget.consume(2, now)).toThrow(/too frequent/iu);
    expect(() => budget.consume(3, new Date(now.valueOf() + 60_000))).not.toThrow();
    expect(JSON.stringify(budget)).not.toMatch(/ip|user|token/iu);
  });
});
