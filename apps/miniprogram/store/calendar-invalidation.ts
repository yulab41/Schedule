export interface CalendarInvalidationIdentity {
  readonly businessMonth: string;
  readonly groupId: string;
  readonly userId: string;
}

export interface CalendarInvalidationRegistry {
  getEpoch(identity: CalendarInvalidationIdentity): number;
  invalidate(identity: CalendarInvalidationIdentity): number;
}

export interface CalendarInvalidationObserver {
  consume(
    context: Omit<CalendarInvalidationIdentity, 'businessMonth'>,
    businessMonths: readonly string[],
  ): readonly string[];
  observe(
    context: Omit<CalendarInvalidationIdentity, 'businessMonth'>,
    businessMonths: readonly string[],
  ): void;
}

function assertIdentity(identity: CalendarInvalidationIdentity): void {
  if (
    identity.userId.length === 0 ||
    identity.groupId.length === 0 ||
    !/^\d{4}-\d{2}$/u.test(identity.businessMonth)
  ) {
    throw new Error('Calendar invalidation identity is invalid.');
  }
}

export function buildCalendarInvalidationKey(identity: CalendarInvalidationIdentity): string {
  assertIdentity(identity);
  return `${identity.userId}:${identity.groupId}:${identity.businessMonth}`;
}

export function createCalendarInvalidationRegistry(): CalendarInvalidationRegistry {
  const epochs = new Map<string, number>();
  return {
    getEpoch(identity) {
      return epochs.get(buildCalendarInvalidationKey(identity)) ?? 0;
    },
    invalidate(identity) {
      const key = buildCalendarInvalidationKey(identity);
      const next = (epochs.get(key) ?? 0) + 1;
      epochs.set(key, next);
      return next;
    },
  };
}

export function createCalendarInvalidationObserver(
  registry: CalendarInvalidationRegistry,
): CalendarInvalidationObserver {
  const observedEpochs = new Map<string, number>();
  const identityFor = (
    context: Omit<CalendarInvalidationIdentity, 'businessMonth'>,
    businessMonth: string,
  ): CalendarInvalidationIdentity => ({ ...context, businessMonth });
  return {
    consume(context, businessMonths) {
      const invalidated: string[] = [];
      for (const businessMonth of new Set(businessMonths)) {
        const identity = identityFor(context, businessMonth);
        const key = buildCalendarInvalidationKey(identity);
        const currentEpoch = registry.getEpoch(identity);
        const previousEpoch = observedEpochs.get(key);
        observedEpochs.set(key, currentEpoch);
        if (previousEpoch !== undefined && previousEpoch !== currentEpoch)
          invalidated.push(businessMonth);
      }
      return invalidated;
    },
    observe(context, businessMonths) {
      for (const businessMonth of new Set(businessMonths)) {
        const identity = identityFor(context, businessMonth);
        observedEpochs.set(buildCalendarInvalidationKey(identity), registry.getEpoch(identity));
      }
    },
  };
}

export const calendarInvalidationRegistry = createCalendarInvalidationRegistry();
