CREATE TABLE external_duty_baselines (
  assignment_id CHAR(36) PRIMARY KEY,
  schedule_period_id CHAR(36) NOT NULL,
  group_id CHAR(36) NOT NULL,
  business_date DATE NOT NULL,
  member_name VARCHAR(100) NULL,
  membership_id CHAR(36) NULL,
  assignment_version INT UNSIGNED NOT NULL,
  captured_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);
--> statement-breakpoint
INSERT INTO external_duty_baselines (
  assignment_id, schedule_period_id, group_id, business_date,
  member_name, membership_id, assignment_version
)
SELECT a.id, p.id, p.group_id, a.business_date,
  COALESCE(a.actual_member_name, a.planned_member_name),
  COALESCE(a.actual_membership_id, a.planned_membership_id), a.version
FROM shift_assignments a
JOIN schedule_periods p ON p.id = a.schedule_period_id
JOIN `groups` g ON g.id = p.group_id
JOIN schedule_roles r ON r.id = p.schedule_role_id AND r.group_id = g.id
JOIN shift_types s ON s.id = a.shift_type_id AND s.group_id = g.id
WHERE g.name = '头颈外科医生' AND r.name = '一线' AND s.name = '全天班'
  AND p.status = 'published' AND s.is_enabled = 1
  AND a.business_date >= DATE(UTC_TIMESTAMP() + INTERVAL 8 HOUR)
  AND a.business_date <= '2027-06-30'
  AND a.deleted_at IS NULL AND p.deleted_at IS NULL AND g.deleted_at IS NULL
  AND r.deleted_at IS NULL AND s.deleted_at IS NULL;
