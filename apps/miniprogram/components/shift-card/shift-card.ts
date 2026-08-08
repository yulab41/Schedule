import type { CalendarDutyAssignment, CalendarDutyMember } from '@schedule/contracts';

import {
  formatShiftTimeRange,
  getCalendarMarkerLabel,
  getConfirmedPhoneOptions,
  getDutyMemberName,
  type DutyPhoneOption,
} from '../../utils/calendar.js';

interface ShiftCardData {
  readonly canCall: boolean;
  readonly markerLabels: readonly string[];
  readonly memberName: string;
  readonly phoneOptions: readonly DutyPhoneOption[];
  readonly shiftTime: string;
}

Component({
  properties: {
    assignment: { type: Object, value: null },
    hideShiftBadge: { type: Boolean, value: false },
    member: { type: Object, value: null },
  },

  data: {
    canCall: false,
    markerLabels: [],
    memberName: '',
    phoneOptions: [],
    shiftTime: '',
  } as ShiftCardData,

  observers: {
    'assignment, member': function syncCard(
      assignment: CalendarDutyAssignment | null,
      member: CalendarDutyMember | null,
    ) {
      if (assignment === null) {
        this.setData({
          canCall: false,
          markerLabels: [],
          memberName: '',
          phoneOptions: [],
          shiftTime: '',
        });
        return;
      }
      const phoneOptions = getConfirmedPhoneOptions(member ?? undefined);
      this.setData({
        canCall: phoneOptions.length > 0,
        markerLabels: assignment.changeMarkers.map(getCalendarMarkerLabel),
        memberName: getDutyMemberName(assignment),
        phoneOptions,
        shiftTime: formatShiftTimeRange(assignment),
      });
    },
  },

  methods: {
    handleTap() {
      const assignment = this.data.assignment as CalendarDutyAssignment | null;
      if (assignment !== null) {
        this.triggerEvent('dutytap', { assignmentId: assignment.id });
      }
    },

    handleCall(event: WechatMiniprogram.TouchEvent) {
      const number = event.currentTarget.dataset.number;
      if (typeof number === 'string' && number.length > 0) {
        this.triggerEvent('call', { number });
      }
    },
  },
});
