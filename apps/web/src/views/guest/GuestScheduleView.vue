<script setup lang="ts">
import type { ConfirmedHolidayDate, GuestCalendarReadModel } from '@schedule/contracts';
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { ApiClientError, createApiClient } from '../../api/client.js';
import { cloudbaseAuth } from '../../auth/cloudbase.js';
import {
  addBusinessMonths,
  getBusinessMonthLabel,
  getCurrentBusinessMonth,
} from '../../features/calendar/calendar-logic.js';
import MonthGrid from '../../features/calendar/MonthGrid.vue';

const api = createApiClient({ auth: cloudbaseAuth });
const router = useRouter();
const businessMonth = ref(getCurrentBusinessMonth());
const calendarResult = ref<GuestCalendarReadModel>();
const errorMessage = ref<string>();
const groupCode = ref('');
const isLoading = ref(false);
const holidays = new Map<string, ConfirmedHolidayDate>();

async function loadCalendar(): Promise<void> {
  const normalizedCode = groupCode.value.trim();
  if (!/^\d{4}$/.test(normalizedCode)) {
    errorMessage.value = '请输入 4 位群组码。';
    return;
  }

  errorMessage.value = undefined;
  isLoading.value = true;
  try {
    calendarResult.value = await api.getGuestCalendar(normalizedCode, businessMonth.value);
  } catch (error) {
    calendarResult.value = undefined;
    errorMessage.value =
      error instanceof ApiClientError ? error.message : '排班暂时无法加载，请稍后重试。';
  } finally {
    isLoading.value = false;
  }
}

async function changeMonth(delta: number): Promise<void> {
  businessMonth.value = addBusinessMonths(businessMonth.value, delta);
  if (calendarResult.value !== undefined) {
    await loadCalendar();
  }
}

async function selectMonth(): Promise<void> {
  if (calendarResult.value !== undefined) {
    await loadCalendar();
  }
}
</script>

<template>
  <main class="guest-schedule-page">
    <header class="guest-header">
      <strong class="product-name">排班查看</strong>
      <t-button variant="text" @click="router.push({ name: 'login' })">返回登录</t-button>
    </header>

    <section v-if="calendarResult === undefined" class="guest-access-panel">
      <h1>访客查看</h1>
      <form class="guest-access-form" @submit.prevent="loadCalendar">
        <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
        <t-form-item label="群组码">
          <t-input
            v-model="groupCode"
            autocomplete="one-time-code"
            inputmode="numeric"
            maxlength="4"
            placeholder="请输入 4 位群组码"
          />
        </t-form-item>
        <t-form-item label="月份">
          <input v-model="businessMonth" class="guest-month-input" type="month" />
        </t-form-item>
        <t-button block :loading="isLoading" theme="primary" type="submit">查看排班</t-button>
      </form>
    </section>

    <section v-else class="guest-calendar" :aria-busy="isLoading">
      <div class="guest-calendar-title">
        <div>
          <span class="guest-label">访客查看</span>
          <h1>{{ calendarResult.groupName }}</h1>
        </div>
        <t-button
          variant="outline"
          @click="
            calendarResult = undefined;
            errorMessage = undefined;
          "
        >
          更换群组
        </t-button>
      </div>

      <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
      <div class="guest-calendar-toolbar">
        <t-button variant="outline" @click="changeMonth(-1)">上一月</t-button>
        <strong>{{ getBusinessMonthLabel(businessMonth) }}</strong>
        <t-button variant="outline" @click="changeMonth(1)">下一月</t-button>
        <label>
          年月
          <input v-model="businessMonth" type="month" @change="selectMonth" />
        </label>
      </div>

      <t-loading v-if="isLoading" text="正在加载排班" />
      <MonthGrid
        v-else
        :assignments="calendarResult.calendar.assignments"
        :business-month="calendarResult.calendar.businessMonth"
        :holidays="holidays"
        :members="calendarResult.calendar.members"
      />
    </section>
  </main>
</template>

<style scoped>
.guest-schedule-page {
  min-height: 100vh;
  background: var(--ui-color-background);
}

.guest-header {
  display: flex;
  min-height: 56px;
  padding: 0 24px;
  align-items: center;
  justify-content: space-between;
  background: var(--ui-color-surface);
  border-bottom: 1px solid var(--ui-color-border);
}

.guest-access-panel {
  display: grid;
  width: min(100% - 32px, 440px);
  margin: 72px auto;
  gap: 20px;
  padding: 24px;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: 8px;
}

.guest-access-panel h1,
.guest-calendar h1 {
  margin: 0;
  font-size: var(--ui-font-size-xl);
}

.guest-access-form {
  display: grid;
  gap: 16px;
}

.guest-month-input,
.guest-calendar-toolbar input {
  min-height: 32px;
  padding: 4px 8px;
  border: 1px solid var(--ui-color-border-strong);
  border-radius: 4px;
}

.guest-calendar {
  display: grid;
  width: min(100% - 32px, 1280px);
  margin: 24px auto;
  gap: 16px;
}

.guest-calendar-title,
.guest-calendar-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.guest-label {
  display: block;
  margin-bottom: 4px;
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-sm);
}

.guest-calendar-toolbar {
  justify-content: flex-start;
  padding: 12px;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: 6px;
}

.guest-calendar-toolbar strong {
  min-width: 88px;
  text-align: center;
}

.guest-calendar-toolbar label {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  color: var(--ui-color-text-secondary);
}

@media (max-width: 640px) {
  .guest-header {
    padding: 0 16px;
  }

  .guest-calendar {
    width: 100%;
    margin: 16px 0;
    padding: 0 12px 20px;
    overflow-x: auto;
  }

  .guest-calendar :deep(.month-grid) {
    min-width: 760px;
  }
}
</style>
