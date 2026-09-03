<script setup lang="ts">
import type {
  CalendarDutyAssignment,
  CalendarDutyMember,
  ConfirmedHolidayDate,
} from '@schedule/contracts';
import { computed, ref, watch } from 'vue';

import MonthGrid from '../../features/calendar/MonthGrid.vue';
import WeekGrid from '../../features/calendar/WeekGrid.vue';
import Ui2Icon from './Ui2Icon.vue';

export type NurseScheduleLayout = 'desktop' | 'mobile';
export type NurseScheduleScreen = 'calendar' | 'group-settings' | 'member-settings';
export type NurseScheduleView = 'list' | 'month' | 'week';

type ShiftId = 'a' | 'computer' | 'd' | 'n' | 'np' | 'p';
type PreferenceShift = 'follow' | ShiftId;
type PreferenceView = 'follow' | NurseScheduleView;

interface ShiftDefinition {
  readonly abbreviation: string;
  readonly color: string;
  readonly end: string;
  readonly endDayOffset: 0 | 1;
  readonly id: ShiftId;
  readonly name: string;
  readonly start: string;
  readonly textColor: string;
}

interface ShiftGroup extends ShiftDefinition {
  readonly staff: readonly CalendarDutyMember[];
}

interface PlannedShift {
  readonly id: ShiftId;
  readonly staffIds: readonly string[];
}

interface PlannedDay {
  readonly date: string;
  readonly shifts: readonly PlannedShift[];
}

const props = withDefaults(
  defineProps<{
    readonly initialView?: NurseScheduleView;
    readonly layout?: NurseScheduleLayout;
    readonly screen?: NurseScheduleScreen;
  }>(),
  { initialView: 'week', layout: 'mobile', screen: 'calendar' },
);

const shiftOrder: readonly ShiftId[] = ['computer', 'd', 'a', 'p', 'n', 'np'];
const viewOptions: readonly { label: string; value: NurseScheduleView }[] = [
  { label: '月', value: 'month' },
  { label: '周', value: 'week' },
  { label: '列表', value: 'list' },
];

const shiftDefinitions: Readonly<Record<ShiftId, ShiftDefinition>> = {
  computer: {
    abbreviation: '电脑',
    color: '#68798d',
    end: '16:00',
    endDayOffset: 0,
    id: 'computer',
    name: '电脑班',
    start: '07:30',
    textColor: '#ffffff',
  },
  d: {
    abbreviation: 'D',
    color: '#0a66d5',
    end: '17:30',
    endDayOffset: 0,
    id: 'd',
    name: 'D 班',
    start: '08:00',
    textColor: '#ffffff',
  },
  a: {
    abbreviation: 'A',
    color: '#187a71',
    end: '16:30',
    endDayOffset: 0,
    id: 'a',
    name: 'A 班',
    start: '08:30',
    textColor: '#ffffff',
  },
  p: {
    abbreviation: 'P',
    color: '#7762a8',
    end: '22:00',
    endDayOffset: 0,
    id: 'p',
    name: 'P 班',
    start: '14:00',
    textColor: '#ffffff',
  },
  n: {
    abbreviation: 'N',
    color: '#31547b',
    end: '08:00',
    endDayOffset: 1,
    id: 'n',
    name: 'N 班',
    start: '17:00',
    textColor: '#ffffff',
  },
  np: {
    abbreviation: 'NP',
    color: '#b84e63',
    end: '11:00',
    endDayOffset: 1,
    id: 'np',
    name: 'NP 班',
    start: '17:30',
    textColor: '#ffffff',
  },
};

const members: readonly CalendarDutyMember[] = [
  {
    isConfirmed: true,
    membershipId: 'lin',
    mobilePhone: '13800138000',
    realName: '林恩宇',
    shortPhone: '6618',
  },
  {
    isConfirmed: true,
    membershipId: 'zhou',
    mobilePhone: '13800138001',
    realName: '周佩珊',
    shortPhone: '6639',
  },
  {
    isConfirmed: true,
    membershipId: 'chen',
    mobilePhone: '13800138002',
    realName: '陈晓燕',
    shortPhone: '6632',
  },
  {
    isConfirmed: true,
    membershipId: 'wang',
    mobilePhone: '13800138003',
    realName: '王静怡',
    shortPhone: '6656',
  },
  {
    isConfirmed: true,
    membershipId: 'huang',
    mobilePhone: '13800138004',
    realName: '黄婉婷',
    shortPhone: '6619',
  },
  {
    isConfirmed: true,
    membershipId: 'li',
    mobilePhone: '13800138005',
    realName: '李佳雯',
    shortPhone: '6651',
  },
  {
    isConfirmed: true,
    membershipId: 'he',
    mobilePhone: '13800138006',
    realName: '何嘉仪',
    shortPhone: '6628',
  },
  {
    isConfirmed: true,
    membershipId: 'xu',
    mobilePhone: '13800138007',
    realName: '许欣怡',
    shortPhone: '6673',
  },
];

const schedulePlan: readonly PlannedDay[] = [
  { date: '2026-08-03', shifts: [{ id: 'd', staffIds: ['lin', 'chen'] }] },
  { date: '2026-08-05', shifts: [{ id: 'd', staffIds: ['zhou', 'wang', 'huang'] }] },
  { date: '2026-08-07', shifts: [{ id: 'd', staffIds: ['li'] }] },
  { date: '2026-08-10', shifts: [{ id: 'd', staffIds: ['xu', 'he'] }] },
  { date: '2026-08-12', shifts: [{ id: 'd', staffIds: ['chen', 'wang'] }] },
  { date: '2026-08-14', shifts: [{ id: 'd', staffIds: ['lin'] }] },
  {
    date: '2026-08-17',
    shifts: [
      { id: 'computer', staffIds: ['xu'] },
      { id: 'd', staffIds: ['chen', 'zhou'] },
      { id: 'p', staffIds: ['wang'] },
      { id: 'n', staffIds: ['huang', 'li'] },
    ],
  },
  {
    date: '2026-08-18',
    shifts: [
      { id: 'computer', staffIds: ['he'] },
      { id: 'd', staffIds: ['lin', 'xu', 'huang'] },
      { id: 'a', staffIds: ['lin', 'chen', 'wang'] },
      { id: 'p', staffIds: ['xu', 'zhou'] },
      { id: 'np', staffIds: ['li'] },
    ],
  },
  {
    date: '2026-08-19',
    shifts: [
      { id: 'computer', staffIds: ['xu'] },
      { id: 'd', staffIds: ['lin', 'chen', 'zhou'] },
      { id: 'a', staffIds: ['wang', 'huang'] },
      { id: 'p', staffIds: ['li', 'he'] },
      { id: 'n', staffIds: ['xu', 'chen'] },
      { id: 'np', staffIds: ['zhou'] },
    ],
  },
  {
    date: '2026-08-20',
    shifts: [
      { id: 'd', staffIds: ['he', 'wang', 'xu'] },
      { id: 'a', staffIds: ['chen', 'li'] },
      { id: 'p', staffIds: ['zhou'] },
      { id: 'n', staffIds: ['lin', 'huang'] },
    ],
  },
  {
    date: '2026-08-21',
    shifts: [
      { id: 'computer', staffIds: ['huang', 'li'] },
      { id: 'd', staffIds: ['chen', 'zhou'] },
      { id: 'p', staffIds: ['wang', 'xu', 'he'] },
      { id: 'np', staffIds: ['lin'] },
    ],
  },
  {
    date: '2026-08-22',
    shifts: [
      { id: 'd', staffIds: ['lin', 'xu'] },
      { id: 'n', staffIds: ['chen', 'li'] },
    ],
  },
  {
    date: '2026-08-23',
    shifts: [
      { id: 'a', staffIds: ['zhou', 'wang'] },
      { id: 'np', staffIds: ['huang'] },
    ],
  },
  { date: '2026-08-26', shifts: [{ id: 'd', staffIds: ['he', 'huang', 'li'] }] },
  { date: '2026-08-28', shifts: [{ id: 'd', staffIds: ['lin', 'wang'] }] },
  { date: '2026-08-31', shifts: [{ id: 'd', staffIds: ['chen', 'zhou'] }] },
];

const membersById = new Map(members.map((member) => [member.membershipId, member]));
const emptyHolidays: ReadonlyMap<string, ConfirmedHolidayDate> = new Map();

function chinaTimeIso(date: string, time: string, dayOffset: number): string {
  const [year = 0, month = 0, day = 0] = date.split('-').map(Number);
  const [hour = 0, minute = 0] = time.split(':').map(Number);
  return new Date(Date.UTC(year, month - 1, day + dayOffset, hour - 8, minute)).toISOString();
}

function buildAssignments(day: PlannedDay): readonly CalendarDutyAssignment[] {
  let slotPosition = 0;
  return day.shifts.flatMap((plannedShift) => {
    const definition = shiftDefinitions[plannedShift.id];
    return plannedShift.staffIds.flatMap((membershipId) => {
      const member = membersById.get(membershipId);
      if (member === undefined) return [];
      slotPosition += 1;
      return [
        {
          businessDate: day.date,
          changeMarkers: [],
          endsAt: chinaTimeIso(day.date, definition.end, definition.endDayOffset),
          id: `${day.date}:${plannedShift.id}:${membershipId}`,
          plannedMemberName: member.realName,
          plannedMembershipId: membershipId,
          schedulePeriodId: 'preview-period-2026-08',
          scheduleRoleId: 'nurse-duty',
          scheduleRoleName: '护理值班',
          shiftTypeAbbreviation: definition.abbreviation,
          shiftTypeColor: definition.color,
          shiftTypeId: definition.id,
          shiftTypeName: definition.name,
          shiftTypeTextColor: definition.textColor,
          slotPosition,
          startsAt: chinaTimeIso(day.date, definition.start, 0),
        },
      ];
    });
  });
}

const allAssignments: readonly CalendarDutyAssignment[] = schedulePlan.flatMap(buildAssignments);
const activeView = ref<NurseScheduleView>(props.initialView);
const selectedDate = ref('2026-08-19');
const selectedMonthShift = ref<ShiftId>('d');
const expandedPersonKey = ref<string>();
const groupDefaultView = ref<NurseScheduleView>('week');
const groupMonthShift = ref<ShiftId>('d');
const memberDefaultView = ref<PreferenceView>('follow');
const memberMonthShift = ref<PreferenceShift>('follow');
const savedMessage = ref('');

watch(
  () => props.initialView,
  (view) => {
    activeView.value = view;
  },
);

const monthAssignments = computed(() =>
  allAssignments.filter((assignment) => assignment.shiftTypeId === selectedMonthShift.value),
);
const selectedDateAssignments = computed(() =>
  allAssignments.filter((assignment) => assignment.businessDate === selectedDate.value),
);
const selectedDateShiftGroups = computed<readonly ShiftGroup[]>(() =>
  shiftOrder.flatMap((shiftId) => {
    const definition = shiftDefinitions[shiftId];
    const assignments = selectedDateAssignments.value.filter(
      (assignment) => assignment.shiftTypeId === shiftId,
    );
    if (assignments.length === 0) return [];
    return [
      {
        ...definition,
        staff: assignments
          .map((assignment) => {
            const membershipId = assignment.actualMembershipId ?? assignment.plannedMembershipId;
            return membershipId === undefined ? undefined : membersById.get(membershipId);
          })
          .filter((member) => member !== undefined),
      },
    ];
  }),
);
const shiftOptions = computed(() => shiftOrder.map((shiftId) => shiftDefinitions[shiftId]));
const resolvedMemberView = computed(() =>
  memberDefaultView.value === 'follow' ? groupDefaultView.value : memberDefaultView.value,
);
const resolvedMemberShift = computed(() =>
  memberMonthShift.value === 'follow' ? groupMonthShift.value : memberMonthShift.value,
);
const selectedDateLabel = computed(() => {
  const date = new Date(`${selectedDate.value}T00:00:00+08:00`);
  const weekday = new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(date);
  return `2026年8月${Number(selectedDate.value.slice(8))}日 · ${weekday}`;
});

function selectDate(date: string): void {
  selectedDate.value = date;
  expandedPersonKey.value = undefined;
}

function setView(view: NurseScheduleView): void {
  activeView.value = view;
  savedMessage.value = '';
}

function phoneKey(shiftId: ShiftId, membershipId: string): string {
  return `${shiftId}:${membershipId}`;
}

function togglePhone(shiftId: ShiftId, membershipId: string): void {
  const key = phoneKey(shiftId, membershipId);
  expandedPersonKey.value = expandedPersonKey.value === key ? undefined : key;
}

function dialHref(number: string): string {
  return `tel:${number}`;
}
function viewLabel(view: NurseScheduleView): string {
  return viewOptions.find((option) => option.value === view)?.label ?? view;
}
function savePreferences(): void {
  savedMessage.value = props.screen === 'group-settings' ? '群组默认已保存' : '我的偏好已保存';
}
</script>

<template>
  <main class="nurse-schedule-preview" :class="[`layout-${layout}`, `screen-${screen}`]">
    <div class="preview-shell">
      <header class="app-header">
        <div class="group-heading">
          <span class="group-mark" aria-hidden="true">头颈</span>
          <div>
            <p>头颈外科护士</p>
            <h1>{{ screen === 'calendar' ? '排班日历' : '日历偏好' }}</h1>
          </div>
        </div>
        <button type="button" class="header-action" aria-label="通知">
          <Ui2Icon name="bell" /><span class="notification-dot" />
        </button>
      </header>

      <template v-if="screen === 'calendar'">
        <section class="calendar-toolbar" aria-label="日历视图">
          <div class="view-segment" role="tablist" aria-label="切换日历视图">
            <button
              v-for="option in viewOptions"
              :key="option.value"
              type="button"
              role="tab"
              :aria-selected="activeView === option.value"
              :class="{ 'is-active': activeView === option.value }"
              @click="setView(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
          <button type="button" class="filter-action"><Ui2Icon name="filter" />筛选</button>
        </section>

        <section v-if="activeView === 'month'" class="calendar-view-section">
          <header class="period-heading">
            <button type="button" aria-label="上个月"><Ui2Icon name="chevron-left" /></button
            ><strong>2026年8月</strong
            ><button type="button" aria-label="下个月"><Ui2Icon name="chevron-right" /></button>
          </header>
          <p class="calendar-scope-note">
            月视图当前仅显示 <strong>{{ shiftDefinitions[selectedMonthShift].name }}</strong
            >，值班人员姓名保持逐一显示。
          </p>
          <div class="production-calendar-frame month-calendar-frame">
            <MonthGrid
              :assignments="monthAssignments"
              business-month="2026-08"
              :holidays="emptyHolidays"
              :members="members"
              :selected-date="selectedDate"
              today="2026-08-19"
              @select-date="selectDate"
            />
          </div>
        </section>

        <section v-else-if="activeView === 'week'" class="calendar-view-section">
          <header class="period-heading">
            <button type="button" aria-label="上一周"><Ui2Icon name="chevron-left" /></button
            ><strong>8月17日–23日</strong
            ><button type="button" aria-label="下一周"><Ui2Icon name="chevron-right" /></button>
          </header>
          <div class="production-calendar-frame week-calendar-frame">
            <WeekGrid
              :assignments="allAssignments"
              :holidays="emptyHolidays"
              :members="members"
              :selected-date="selectedDate"
              today="2026-08-19"
              week-start="2026-08-17"
              @select-date="selectDate"
            />
          </div>
        </section>

        <section v-else class="list-placeholder">
          <span><Ui2Icon name="calendar" /></span><strong>列表视图保持现有展示</strong>
          <p>本次预览只调整选中日期下方的班种详情卡片。</p>
          <button type="button" @click="setView('week')">返回周视图</button>
        </section>

        <section
          v-if="activeView !== 'list'"
          class="shift-details-section"
          aria-labelledby="shift-details-title"
        >
          <header class="detail-section-heading">
            <div>
              <p>选中日期</p>
              <h2 id="shift-details-title">{{ selectedDateLabel }}</h2>
            </div>
            <span>{{ selectedDateShiftGroups.length }} 个班种</span>
          </header>
          <div class="detail-card-grid">
            <article
              v-for="shift in selectedDateShiftGroups"
              :key="shift.id"
              class="shift-detail-card"
              :style="{ '--shift-tone': shift.color }"
            >
              <header class="shift-card-heading">
                <span class="shift-code">{{ shift.abbreviation }}</span>
                <div>
                  <strong>{{ shift.name }}</strong
                  ><span
                    >{{ shift.start }}–{{ shift.endDayOffset === 1 ? '次日 ' : ''
                    }}{{ shift.end }}</span
                  >
                </div>
              </header>
              <div class="staff-stack">
                <div
                  v-for="staff in shift.staff"
                  :key="staff.membershipId"
                  class="staff-contact-row"
                >
                  <button
                    type="button"
                    class="staff-name-button"
                    :aria-expanded="expandedPersonKey === phoneKey(shift.id, staff.membershipId)"
                    @click="togglePhone(shift.id, staff.membershipId)"
                  >
                    <span>{{ staff.realName }}</span
                    ><small>护理值班</small><Ui2Icon name="phone" />
                  </button>
                  <div
                    v-if="expandedPersonKey === phoneKey(shift.id, staff.membershipId)"
                    class="phone-split-actions"
                  >
                    <a v-if="staff.shortPhone" :href="dialHref(staff.shortPhone)"
                      ><Ui2Icon name="phone" />短号 {{ staff.shortPhone }}</a
                    ><a v-if="staff.mobilePhone" :href="dialHref(staff.mobilePhone)"
                      ><Ui2Icon name="phone" />手机 {{ staff.mobilePhone }}</a
                    >
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>
      </template>

      <section v-else class="settings-page" aria-labelledby="settings-title">
        <header class="settings-intro">
          <span class="settings-icon"
            ><Ui2Icon :name="screen === 'group-settings' ? 'adjustment' : 'user'"
          /></span>
          <div>
            <p>{{ screen === 'group-settings' ? '群组设置' : '个人设置' }}</p>
            <h2 id="settings-title">
              {{ screen === 'group-settings' ? '群组日历默认设置' : '我的日历偏好' }}
            </h2>
            <span>{{
              screen === 'group-settings'
                ? '群主、群管理员和后台管理员可修改'
                : '只影响你打开排班日历时的初始状态'
            }}</span>
          </div>
        </header>
        <aside v-if="screen === 'group-settings'" class="inheritance-note">
          <span>群组默认</span><i>→</i><span>成员首次打开</span><i>→</i
          ><strong>个人偏好可覆盖</strong>
        </aside>
        <aside v-else class="member-override-note">
          <Ui2Icon name="check" />
          <div>
            <strong>成员的个人设置优先于群组默认</strong>
            <p>选择“跟随群组”后，管理员的后续调整会自动生效。</p>
          </div>
        </aside>
        <div class="settings-surface">
          <section class="settings-row">
            <div class="setting-copy">
              <strong>打开日历时显示</strong
              ><span>{{
                screen === 'group-settings' ? '所有成员的默认视图' : '你的默认视图'
              }}</span>
            </div>
            <div class="setting-segment" role="radiogroup" aria-label="默认视图">
              <button
                v-if="screen === 'member-settings'"
                type="button"
                role="radio"
                :aria-checked="memberDefaultView === 'follow'"
                :class="{ 'is-active': memberDefaultView === 'follow' }"
                @click="memberDefaultView = 'follow'"
              >
                跟随群组
              </button>
              <button
                v-for="option in viewOptions"
                :key="option.value"
                type="button"
                role="radio"
                :aria-checked="
                  screen === 'group-settings'
                    ? groupDefaultView === option.value
                    : memberDefaultView === option.value
                "
                :class="{
                  'is-active':
                    screen === 'group-settings'
                      ? groupDefaultView === option.value
                      : memberDefaultView === option.value,
                }"
                @click="
                  screen === 'group-settings'
                    ? (groupDefaultView = option.value)
                    : (memberDefaultView = option.value)
                "
              >
                {{ option.label }}视图
              </button>
            </div>
          </section>
          <div class="settings-divider" />
          <section class="settings-row">
            <div class="setting-copy">
              <strong>月视图显示班种</strong><span>只筛选班种，不改变月历卡片与人员姓名展示</span>
            </div>
            <div class="setting-shifts" role="radiogroup" aria-label="月视图默认班种">
              <button
                v-if="screen === 'member-settings'"
                type="button"
                role="radio"
                :aria-checked="memberMonthShift === 'follow'"
                :class="{ 'is-active': memberMonthShift === 'follow' }"
                @click="memberMonthShift = 'follow'"
              >
                跟随群组
              </button>
              <button
                v-for="shift in shiftOptions"
                :key="shift.id"
                type="button"
                role="radio"
                :aria-checked="
                  screen === 'group-settings'
                    ? groupMonthShift === shift.id
                    : memberMonthShift === shift.id
                "
                :class="{
                  'is-active':
                    screen === 'group-settings'
                      ? groupMonthShift === shift.id
                      : memberMonthShift === shift.id,
                }"
                @click="
                  screen === 'group-settings'
                    ? (groupMonthShift = shift.id)
                    : (memberMonthShift = shift.id)
                "
              >
                <span :style="{ backgroundColor: shift.color }" />{{ shift.name }}
              </button>
            </div>
          </section>
        </div>
        <section class="preference-result" aria-live="polite">
          <p>{{ screen === 'group-settings' ? '成员默认效果' : '你的打开效果' }}</p>
          <div>
            <span class="result-icon"><Ui2Icon name="calendar" /></span
            ><strong
              >{{
                viewLabel(screen === 'group-settings' ? groupDefaultView : resolvedMemberView)
              }}视图 <small>·</small> 月视图默认
              {{
                shiftDefinitions[
                  screen === 'group-settings' ? groupMonthShift : resolvedMemberShift
                ].name
              }}</strong
            >
          </div>
        </section>
        <button type="button" class="save-preferences" @click="savePreferences">
          {{ screen === 'group-settings' ? '保存群组默认' : '保存我的偏好' }}
        </button>
        <p v-if="savedMessage" class="saved-toast" role="status">{{ savedMessage }}</p>
      </section>

      <nav v-if="layout === 'mobile'" class="mobile-tabbar" aria-label="主要导航">
        <button type="button" class="is-active">
          <Ui2Icon name="calendar" /><span>排班日历</span></button
        ><button type="button"><Ui2Icon name="user" /><span>通讯录</span></button
        ><button type="button"><Ui2Icon name="swap" /><span>换班</span></button
        ><button type="button"><Ui2Icon name="user" /><span>我的</span></button
        ><button type="button"><Ui2Icon name="more" /><span>更多</span></button>
      </nav>
    </div>
  </main>
</template>

<style scoped>
:global(html),
:global(body),
:global(#storybook-root) {
  min-width: 0;
  max-width: 100%;
}
.nurse-schedule-preview {
  --clinical-blue: #0a66d5;
  --clinical-teal: #177b71;
  --canvas: #eef2f6;
  --ink: #18222c;
  --muted: #64717f;
  min-height: 100vh;
  color: var(--ink);
  background: var(--canvas);
  font-family:
    -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Segoe UI', 'Microsoft YaHei',
    sans-serif;
}
button,
a {
  -webkit-tap-highlight-color: transparent;
}
button {
  color: inherit;
  font: inherit;
}
button:focus-visible,
a:focus-visible {
  outline: 3px solid rgb(10 102 213 / 34%);
  outline-offset: 2px;
}
.preview-shell {
  min-height: 100vh;
  padding-bottom: 24px;
}
.layout-desktop .preview-shell {
  width: min(1180px, calc(100% - 64px));
  margin: 0 auto;
}
.layout-mobile .preview-shell {
  width: min(100%, 390px);
  margin: 0 auto;
  padding-bottom: 86px;
  background: #f4f6f8;
}
.app-header {
  display: flex;
  min-height: 76px;
  padding: 14px 18px;
  align-items: center;
  justify-content: space-between;
  background: rgb(255 255 255 / 90%);
  border-bottom: 1px solid #dce2e9;
  backdrop-filter: blur(20px) saturate(180%);
}
.layout-desktop .app-header {
  margin-bottom: 20px;
  padding-inline: 4px;
  background: transparent;
  border: 0;
}
.group-heading {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 11px;
}
.group-mark {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  place-items: center;
  color: #fff;
  background: linear-gradient(145deg, #0a66d5, #134977);
  border-radius: 13px;
  box-shadow: 0 7px 18px rgb(10 102 213 / 22%);
  font-size: 12px;
  font-weight: 750;
}
.group-heading p,
.group-heading h1,
.settings-intro p,
.settings-intro h2,
.settings-intro span,
.detail-section-heading p,
.detail-section-heading h2 {
  margin: 0;
}
.group-heading p {
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
}
.group-heading h1 {
  margin-top: 2px;
  font-size: 21px;
  font-weight: 720;
}
.header-action,
.period-heading > button,
.filter-action {
  display: inline-grid;
  min-width: 44px;
  min-height: 44px;
  padding: 0;
  place-items: center;
  background: transparent;
  border: 0;
  border-radius: 13px;
  cursor: pointer;
}
.header-action {
  position: relative;
  color: var(--clinical-blue);
  font-size: 19px;
}
.notification-dot {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 7px;
  height: 7px;
  background: #e34850;
  border: 2px solid #fff;
  border-radius: 50%;
}
.calendar-toolbar {
  display: flex;
  padding: 12px 16px 8px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.layout-desktop .calendar-toolbar {
  padding: 0 0 16px;
}
.view-segment {
  display: grid;
  width: min(268px, calc(100% - 80px));
  padding: 3px;
  grid-template-columns: repeat(3, 1fr);
  background: #e4e8ed;
  border-radius: 11px;
}
.view-segment button {
  min-height: 44px;
  padding: 0 14px;
  background: transparent;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 650;
}
.view-segment button.is-active {
  background: #fff;
  box-shadow: 0 1px 5px rgb(28 39 50 / 13%);
}
.filter-action {
  display: inline-flex;
  width: auto;
  padding: 0 10px;
  gap: 5px;
  color: var(--clinical-blue);
  font-size: 13px;
  font-weight: 650;
}
.calendar-view-section {
  margin: 0 12px;
  overflow: hidden;
  background: #fff;
  border: 1px solid #dce2e8;
  border-radius: 18px;
}
.layout-desktop .calendar-view-section {
  margin: 0;
  box-shadow: 0 16px 40px rgb(30 49 68 / 8%);
}
.period-heading {
  display: grid;
  min-height: 62px;
  padding: 8px 10px;
  grid-template-columns: 44px minmax(0, 1fr) 44px;
  place-items: center;
  background: #fff;
  border-bottom: 1px solid #e2e7ec;
}
.period-heading strong {
  font-size: 17px;
}
.calendar-scope-note {
  margin: 0;
  padding: 9px 14px;
  color: var(--muted);
  background: #f7f9fb;
  border-bottom: 1px solid #e2e7ec;
  font-size: 11px;
  line-height: 1.45;
}
.calendar-scope-note strong {
  color: var(--clinical-blue);
}
.production-calendar-frame {
  background: #fff;
}
.month-calendar-frame {
  padding: 12px;
}
.week-calendar-frame {
  overflow: hidden;
}
.shift-details-section {
  margin: 12px;
  padding: 14px 12px;
  background: linear-gradient(145deg, #fff, #f7fbff);
  border: 1px solid #dce2e8;
  border-radius: 18px;
  box-shadow: 0 10px 28px rgb(30 49 68 / 7%);
}
.layout-desktop .shift-details-section {
  margin: 16px 0 0;
  padding: 20px;
}
.detail-section-heading {
  display: flex;
  margin-bottom: 14px;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.detail-section-heading p {
  color: var(--clinical-blue);
  font-size: 11px;
  font-weight: 700;
}
.detail-section-heading h2 {
  margin-top: 3px;
  font-size: 18px;
}
.detail-section-heading > span {
  padding: 5px 9px;
  color: var(--clinical-blue);
  background: #e8f2fd;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
}
.detail-card-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.shift-detail-card {
  --shift-tone: var(--clinical-blue);
  position: relative;
  padding: 13px 11px 11px 14px;
  overflow: hidden;
  align-self: start;
  background: #fff;
  border: 1px solid #dce3ea;
  border-radius: 14px;
}
.shift-detail-card::before {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 3px;
  content: '';
  background: var(--shift-tone);
}
.shift-card-heading {
  display: grid;
  min-width: 0;
  grid-template-columns: 36px minmax(0, 1fr);
  align-items: center;
  gap: 9px;
}
.shift-code {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  color: var(--shift-tone);
  background: color-mix(in srgb, var(--shift-tone) 10%, #fff);
  border-radius: 11px;
  font-family: 'SF Mono', 'Cascadia Mono', monospace;
  font-size: 11px;
  font-weight: 750;
}
.shift-card-heading > div {
  display: grid;
  min-width: 0;
  gap: 2px;
}
.shift-card-heading strong {
  font-size: 13px;
}
.shift-card-heading div > span {
  color: var(--muted);
  font-family: 'SF Mono', 'Cascadia Mono', monospace;
  font-size: 10px;
}
.staff-stack {
  display: grid;
  margin-top: 10px;
  gap: 5px;
}
.staff-contact-row {
  min-width: 0;
}
.staff-name-button {
  display: grid;
  width: 100%;
  min-height: 44px;
  padding: 7px 8px;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 7px;
  background: #f6f8fa;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
}
.staff-name-button > span {
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
  font-weight: 680;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.staff-name-button small {
  color: var(--muted);
  font-size: 9px;
  white-space: nowrap;
}
.staff-name-button > :deep(svg) {
  width: 15px;
  height: 15px;
  color: var(--clinical-blue);
}
.phone-split-actions {
  display: grid;
  margin-top: 4px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  overflow: hidden;
  background: #e8f2fd;
  border: 1px solid #c5ddf8;
  border-radius: 10px;
  animation: reveal-phone 180ms cubic-bezier(0.22, 1, 0.36, 1);
}
.phone-split-actions a {
  display: inline-flex;
  min-width: 0;
  min-height: 44px;
  padding: 7px 6px;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: #0756ae;
  font-size: 10px;
  font-weight: 700;
  text-decoration: none;
}
.phone-split-actions a + a {
  border-left: 1px solid #c5ddf8;
}
.phone-split-actions :deep(svg) {
  width: 14px;
  height: 14px;
}
.list-placeholder {
  display: grid;
  min-height: 420px;
  margin: 12px;
  padding: 32px;
  align-content: center;
  justify-items: center;
  gap: 8px;
  background: #fff;
  border: 1px solid #dce2e8;
  border-radius: 18px;
  text-align: center;
}
.list-placeholder > span {
  display: grid;
  width: 52px;
  height: 52px;
  place-items: center;
  color: var(--clinical-blue);
  background: #e7f1fd;
  border-radius: 15px;
  font-size: 24px;
}
.list-placeholder p {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
}
.list-placeholder button,
.save-preferences {
  min-height: 44px;
  padding: 0 18px;
  color: #fff;
  background: var(--clinical-blue);
  border: 0;
  border-radius: 12px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
}
.settings-page {
  position: relative;
  width: min(720px, calc(100% - 24px));
  margin: 0 auto;
  padding: 18px 0 34px;
}
.settings-intro {
  display: grid;
  padding: 16px;
  grid-template-columns: 48px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  background: #fff;
  border: 1px solid #dce2e8;
  border-radius: 18px;
}
.settings-icon,
.result-icon {
  display: grid;
  place-items: center;
  color: var(--clinical-blue);
  background: #e7f1fd;
  border-radius: 11px;
}
.settings-icon {
  width: 48px;
  height: 48px;
  font-size: 21px;
}
.settings-intro p {
  color: var(--clinical-blue);
  font-size: 11px;
  font-weight: 700;
}
.settings-intro h2 {
  margin-top: 2px;
  font-size: 20px;
}
.settings-intro div > span {
  display: block;
  margin-top: 4px;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.45;
}
.inheritance-note,
.member-override-note {
  margin: 12px 0;
  background: #e9f3fe;
  border: 1px solid #c8def8;
  border-radius: 14px;
}
.inheritance-note {
  display: flex;
  min-height: 54px;
  padding: 10px 14px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #4c5f72;
  font-size: 11px;
}
.inheritance-note span,
.inheritance-note strong {
  padding: 5px 8px;
  background: rgb(255 255 255 / 68%);
  border-radius: 8px;
}
.inheritance-note strong {
  color: #0756ae;
}
.inheritance-note i {
  color: #86a7c9;
  font-style: normal;
}
.member-override-note {
  display: grid;
  padding: 12px;
  grid-template-columns: 30px minmax(0, 1fr);
  align-items: center;
  gap: 9px;
  color: #0756ae;
}
.member-override-note strong,
.member-override-note p {
  margin: 0;
}
.member-override-note strong {
  font-size: 12px;
}
.member-override-note p {
  margin-top: 3px;
  color: #50677f;
  font-size: 10px;
  line-height: 1.45;
}
.settings-surface {
  overflow: hidden;
  background: #fff;
  border: 1px solid #dce2e8;
  border-radius: 18px;
}
.settings-row {
  display: grid;
  padding: 18px;
  grid-template-columns: 180px minmax(0, 1fr);
  gap: 20px;
}
.setting-copy {
  display: grid;
  align-content: start;
  gap: 4px;
}
.setting-copy strong {
  font-size: 14px;
}
.setting-copy span {
  color: var(--muted);
  font-size: 11px;
  line-height: 1.45;
}
.setting-segment,
.setting-shifts {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}
.setting-segment button,
.setting-shifts button {
  min-height: 44px;
  padding: 0 13px;
  color: #465361;
  background: #f5f7f9;
  border: 1px solid #d9e0e7;
  border-radius: 11px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 650;
}
.setting-segment button.is-active,
.setting-shifts button.is-active {
  color: #0756ae;
  background: #e7f1fd;
  border-color: #9cc5f2;
}
.setting-shifts button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.setting-shifts button > span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.settings-divider {
  height: 1px;
  margin-left: 18px;
  background: #e3e7eb;
}
.preference-result {
  margin-top: 12px;
  padding: 14px;
  background: #fff;
  border: 1px solid #dce2e8;
  border-radius: 16px;
}
.preference-result > p {
  margin: 0 0 8px;
  color: var(--muted);
  font-size: 10px;
  font-weight: 650;
}
.preference-result > div {
  display: flex;
  align-items: center;
  gap: 10px;
}
.result-icon {
  width: 34px;
  height: 34px;
}
.preference-result strong {
  font-size: 13px;
}
.preference-result small {
  color: #9aa4af;
}
.save-preferences {
  width: 100%;
  margin-top: 14px;
}
.saved-toast {
  margin: 10px 0 0;
  color: var(--clinical-teal);
  font-size: 12px;
  font-weight: 700;
  text-align: center;
}
.mobile-tabbar {
  position: fixed;
  z-index: 20;
  right: 0;
  bottom: 0;
  left: 0;
  display: grid;
  width: min(100%, 390px);
  min-height: 66px;
  margin: 0 auto;
  padding: 5px 8px max(5px, env(safe-area-inset-bottom));
  grid-template-columns: repeat(5, 1fr);
  background: rgb(251 252 253 / 94%);
  border-top: 1px solid #dce2e8;
  backdrop-filter: blur(22px) saturate(180%);
}
.mobile-tabbar button {
  display: grid;
  min-height: 52px;
  padding: 3px;
  place-items: center;
  align-content: center;
  gap: 2px;
  color: #7b8794;
  background: transparent;
  border: 0;
  border-radius: 10px;
  font-size: 18px;
}
.mobile-tabbar button.is-active {
  color: var(--clinical-blue);
}
.mobile-tabbar span {
  font-size: 9px;
  font-weight: 650;
}
@keyframes reveal-phone {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}
@media (max-width: 700px) {
  .layout-desktop .preview-shell {
    width: 100%;
  }
  .month-calendar-frame {
    padding: 0;
  }
  .detail-card-grid {
    grid-template-columns: 1fr;
  }
  .settings-page {
    width: auto;
    margin: 0 12px;
    padding-top: 12px;
  }
  .inheritance-note {
    justify-content: flex-start;
    overflow-x: auto;
    white-space: nowrap;
  }
  .settings-row {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .setting-segment,
  .setting-shifts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .setting-segment button,
  .setting-shifts button {
    justify-content: center;
  }
}
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
</style>
