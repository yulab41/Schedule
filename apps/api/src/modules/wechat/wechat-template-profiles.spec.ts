import { describe, expect, it } from 'vitest';
import {
  buildProfileTemplateData,
  readProfileTemplate,
  resolveBusinessKind,
} from './wechat-template-profiles.js';

describe('separate approved notification templates', () => {
  it('routes workflow approval and completed schedule changes by their source', () => {
    expect(resolveBusinessKind('approval_pending', { requestType: 'swap' })).toBe('swap');
    expect(resolveBusinessKind('approval_pending', { requestType: 'leave' })).toBe('leave');
    expect(resolveBusinessKind('schedule_changed', { dutyAdjustmentId: 'id' })).toBe(
      'dutyAdjustment',
    );
    expect(resolveBusinessKind('schedule_changed', { swapRequestId: 'id' })).toBe('swap');
    expect(resolveBusinessKind('leave_request_revoked')).toBe('leave');
    expect(resolveBusinessKind('schedule_published')).toBe('business');
  });
  it('uses full schedule dates and the operator, never the notification recipient', () => {
    const config = readProfileTemplate('business', {
      WECHAT_BUSINESS_TEMPLATE_ID: 'schedule-update',
      WECHAT_BUSINESS_TEMPLATE_FIELDS: JSON.stringify({
        dateRange: 'date2',
        status: 'thing7',
        summary: 'thing4',
        actorName: 'name3',
      }),
    })!;
    expect(
      buildProfileTemplateData(config, {
        startDate: '2026-09-07',
        endDate: '2026-09-20',
        actorName: '操作甲',
        status: '新增',
      }),
    ).toEqual({
      date2: { value: '2026-09-07~2026-09-20' },
      thing7: { value: '新增' },
      thing4: { value: '09-07~09-20排班已更新！' },
      name3: { value: '操作甲' },
    });
  });
  it('keeps complete names in the approved compact shift summary and uses an explicit overflow label', () => {
    const config = readProfileTemplate('swap', {
      WECHAT_SWAP_TEMPLATE_ID: 'swap',
      WECHAT_SWAP_TEMPLATE_FIELDS: JSON.stringify({
        actorName: 'short_thing1',
        participantsHint: 'short_thing4',
        dateRange: 'time2',
        swapSummary: 'thing3',
        reason: 'thing5',
      }),
    })!;
    const snapshot = {
      actorName: '操作甲',
      initiatorName: '张三丰',
      targetName: '李四海',
      initiatorDate: '2026-09-12',
      targetDate: '2026-09-13',
      initiatorShift: 'A',
      targetShift: 'P',
      startDate: '2026-09-12',
      endDate: '2026-09-13',
      reason: '个人事务',
      status: '待审批',
    };
    const data = buildProfileTemplateData(config, snapshot);
    expect(data.short_thing4?.value).toBe('见换班岗位');
    expect(data.thing3?.value).toBe('张三丰0912A→李四海0913P');
    expect(data.thing5?.value).toBe('待审批：个人事务');
    const long = buildProfileTemplateData(config, {
      ...snapshot,
      initiatorName: '完整的较长名字甲',
      targetName: '完整的较长名字乙',
    });
    expect(long.thing3?.value).toBe('人员姓名过长，点击查看换班详情');
    expect(() =>
      buildProfileTemplateData(config, { ...snapshot, actorName: '六个汉字姓名' }),
    ).toThrow();
  });
  it('fails closed for missing, duplicate, malformed and cross-template configuration', () => {
    expect(readProfileTemplate('leave', {})).toBeUndefined();
    expect(
      readProfileTemplate('business', {
        WECHAT_BUSINESS_TEMPLATE_ID: 'same',
        WECHAT_DUTY_REMINDER_TEMPLATE_ID: 'same',
        WECHAT_BUSINESS_TEMPLATE_FIELDS: '{}',
      }),
    ).toBeUndefined();
    expect(() =>
      buildProfileTemplateData(
        { kind: 'business', id: 'id', fields: { dateRange: 'date2' } },
        { startDate: '2026-02-30', endDate: '2026-03-01' },
      ),
    ).toThrow();
  });
});
