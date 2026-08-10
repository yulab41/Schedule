import type { GroupRole } from '@schedule/contracts';

import type {
  CalendarAssignmentViewModel,
  CalendarDayViewModel,
  CalendarMonthDataViewModel,
  CalendarPhoneActionViewModel,
} from './calendar-view-model.js';

export type CalendarRouteTarget =
  | { readonly assignment: CalendarAssignmentViewModel; readonly kind: 'assignment' }
  | { readonly day: CalendarDayViewModel; readonly kind: 'date' }
  | { readonly assignment: CalendarAssignmentViewModel; readonly kind: 'events' }
  | {
      readonly assignment: CalendarAssignmentViewModel;
      readonly kind: 'phone';
      readonly phoneAction: CalendarPhoneActionViewModel;
    };

const markerActionIdPattern = /^.+:marker:(swap|leave-cover|overtime):\d+$/u;
const phoneActionIdPattern = /^.+:phone:(长号|短号)$/u;

function* getDays(
  viewModels: readonly CalendarMonthDataViewModel[],
): Generator<CalendarDayViewModel> {
  for (const viewModel of viewModels) {
    for (const week of viewModel.weeks) {
      for (const day of week.days) {
        if (day.kind === 'day') {
          yield day;
        }
      }
    }
  }
}

export function resolveCalendarRouteAction(
  actionId: string,
  role: GroupRole,
  viewModels: readonly CalendarMonthDataViewModel[],
): CalendarRouteTarget | undefined {
  if (actionId.length === 0 || viewModels.length === 0) {
    return undefined;
  }

  for (const day of getDays(viewModels)) {
    if (day.routeActionId === actionId) {
      return { day, kind: 'date' };
    }
    for (const assignment of day.assignments) {
      if (assignment.routeActionId === actionId) {
        return { assignment, kind: 'assignment' };
      }
    }
  }

  if (markerActionIdPattern.test(actionId)) {
    for (const day of getDays(viewModels)) {
      for (const assignment of day.assignments) {
        if (assignment.markers.some((marker) => marker.actionId === actionId)) {
          return role === 'guest'
            ? { assignment, kind: 'assignment' }
            : { assignment, kind: 'events' };
        }
      }
    }
  }

  if (phoneActionIdPattern.test(actionId)) {
    for (const day of getDays(viewModels)) {
      for (const assignment of day.assignments) {
        const phoneAction = assignment.phoneActions.find((action) => action.actionId === actionId);
        if (phoneAction !== undefined) {
          return { assignment, kind: 'phone', phoneAction };
        }
      }
    }
  }

  return undefined;
}
