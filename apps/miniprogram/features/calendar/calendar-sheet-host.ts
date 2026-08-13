import type {
  CalendarDayViewModel,
  CalendarAssignmentViewModel,
  CalendarPhoneActionViewModel,
} from './calendar-view-model.js';

export type CalendarSheetContent =
  | { readonly day: CalendarDayViewModel; readonly kind: 'date' }
  | { readonly assignment: CalendarAssignmentViewModel; readonly kind: 'duty' }
  | { readonly assignment: CalendarAssignmentViewModel; readonly kind: 'events' }
  | {
      readonly assignment: CalendarAssignmentViewModel;
      readonly kind: 'phone';
      readonly phoneActions: readonly CalendarPhoneActionViewModel[];
    };

export type CalendarSheetKind = CalendarSheetContent['kind'] | 'none';

export interface CalendarSheetHostState {
  readonly content?: CalendarSheetContent;
  readonly sheetKey: number;
  readonly visible: boolean;
}

export function openCalendarSheet(
  current: CalendarSheetHostState,
  content: CalendarSheetContent,
): CalendarSheetHostState {
  return { content, sheetKey: current.sheetKey + 1, visible: true };
}

export function requestCalendarSheetClose(current: CalendarSheetHostState): CalendarSheetHostState {
  return current.visible ? { ...current, visible: false } : current;
}

export function resetCalendarSheet(current: CalendarSheetHostState): CalendarSheetHostState {
  return { sheetKey: current.sheetKey + 1, visible: false };
}

export function completeCalendarSheetClose(
  current: CalendarSheetHostState,
  sheetKey: number,
): CalendarSheetHostState {
  if (current.visible || current.sheetKey !== sheetKey) return current;
  return { sheetKey: current.sheetKey, visible: false };
}

export function getCalendarSheetKind(current: CalendarSheetHostState): CalendarSheetKind {
  return current.content?.kind ?? 'none';
}

export function getCalendarSheetTitle(current: CalendarSheetHostState): string {
  switch (current.content?.kind) {
    case 'date':
      return '日期详情';
    case 'duty':
      return '值班详情';
    case 'events':
      return '事件记录';
    case 'phone':
      return '电话联系';
    default:
      return '';
  }
}
