import { describe, expect, it } from 'vitest';

import { releaseSchemaCompatibility } from './ecs-schema-compatibility.mjs';

describe('persisted history visibility release compatibility', () => {
  const journal = (count, tag) => ({
    entries: Array.from({ length: count }, (_, idx) => ({
      idx,
      tag: idx === count - 1 ? tag : `prior-${idx}`,
    })),
  });

  it('requires persisted visibility columns and indexes', () => {
    expect(
      releaseSchemaCompatibility(journal(69, '0069_member_wechat_notification_kinds')),
    ).toEqual({
      databaseSchemaMin: '69',
      databaseSchemaMax: '69',
    });
  });

  it('fails closed on stale, unknown or malformed migration journals', () => {
    for (const value of [
      journal(52, '0052_old'),
      journal(53, '0053_directory_candidate_covering_index'),
      journal(54, '0054_retire_group_code'),
      journal(55, '0055_account_mobile_phone'),
      journal(56, '0056_retire_automatic_rotation'),
      journal(57, '0057_unknown'),
      journal(57, '0057_group_visitor_links'),
      journal(58, '0058_unknown'),
      journal(58, '0058_export_formats_and_multi_select'),
      journal(59, '0059_unknown'),
      journal(59, '0059_member_wechat_binding_qr'),
      journal(60, '0060_unknown'),
      journal(60, '0060_head_neck_docx_export'),
      journal(61, '0061_unknown'),
      journal(61, '0061_group_visitor_qr_assets'),
      journal(62, '0062_unknown'),
      journal(62, '0062_group_calendar_changes'),
      journal(63, '0063_unknown'),
      journal(63, '0063_account_short_phone_visitor_context'),
      journal(64, '0064_unknown'),
      journal(64, '0064_active_shift_slot'),
      journal(65, '0065_unknown'),
      journal(65, '0065_history_visibility'),
      journal(66, '0066_unknown'),
      journal(66, '0066_notification_visibility'),
      journal(67, '0067_unknown'),
      journal(67, '0067_external_duty_checks'),
      journal(68, '0068_unknown'),
      journal(68, '0068_external_duty_published_baseline'),
      journal(69, '0069_unknown'),
      journal(55, '0055_unknown'),
      journal(54, '0054_other'),
      { entries: [] },
      {},
    ]) {
      expect(() => releaseSchemaCompatibility(value)).toThrow();
    }
  });
});
