-- Read-only. Run with a read-only account; output contains aggregate counts and hashed group keys only.
-- Matches CalendarQuery.collectMarkers ordering and EventQuery's shift-scoped exclusions.
WITH visible_assignments AS (
  SELECT a.id, a.schedule_period_id, p.group_id, a.business_date,
         a.actual_membership_id, a.planned_membership_id,
         a.backfill_at, a.backfill_operator_user_id
  FROM shift_assignments a JOIN schedule_periods p ON BINARY p.id = BINARY a.schedule_period_id
  WHERE a.deleted_at IS NULL AND p.deleted_at IS NULL
    AND p.status IN ('published', 'past')
), event_links AS (
  SELECT e.id AS event_id, e.group_id, e.schedule_period_id, e.event_type,
         e.event_status, e.object_id, e.object_type, e.occurred_at, j.assignment_id
  FROM schedule_events e
  CROSS JOIN JSON_TABLE(e.affected_shift_ids, '$[*]'
    COLUMNS (assignment_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PATH '$')) AS j
), event_evidence AS (
  SELECT a.id, COUNT(DISTINCT CASE WHEN e.event_type NOT IN (
    'manual_schedule_template_applied', 'manual_schedule_template_created',
    'manual_schedule_template_deleted', 'manual_schedule_template_updated',
    'rotation_order_changed', 'schedule_generation_completed',
    'schedule_period_created', 'schedule_period_deleted', 'schedule_period_published',
    'schedule_period_replaced', 'schedule_period_withdrawn', 'schedule_role_changed',
    'schedule_role_corrected', 'shift_type_changed'
  ) THEN e.event_id END) AS timeline_events
  FROM visible_assignments a LEFT JOIN event_links e
    ON BINARY e.assignment_id = BINARY a.id AND BINARY e.group_id = BINARY a.group_id
  GROUP BY a.id
), marker_candidates AS (
  SELECT e.*, CASE
    WHEN e.event_type IN ('swap_completed', 'swap_revoked') THEN 'swap'
    WHEN e.event_type IN ('duty_adjustment_completed', 'duty_adjustment_revoked') THEN 'overtime'
    ELSE 'leave' END AS marker_kind
  FROM event_links e JOIN visible_assignments a
    ON BINARY a.id = BINARY e.assignment_id AND BINARY a.group_id = BINARY e.group_id
    AND BINARY a.schedule_period_id = BINARY e.schedule_period_id
  LEFT JOIN leave_requests l ON e.object_type = 'leave_cover' AND BINARY l.id = BINARY e.object_id
  WHERE e.event_type IN ('swap_completed', 'swap_revoked', 'duty_adjustment_completed',
                        'duty_adjustment_revoked', 'leave_cover_completed')
    AND (e.event_type <> 'leave_cover_completed'
         OR (l.deleted_at IS NULL AND l.status = 'approved'))
), latest_marker AS (
  SELECT m.*, ROW_NUMBER() OVER (
    PARTITION BY assignment_id, marker_kind ORDER BY occurred_at DESC, event_id DESC
  ) AS rn FROM marker_candidates m
), marker_evidence AS (
  SELECT m.assignment_id,
    SUM(m.event_type IN ('swap_completed', 'duty_adjustment_completed', 'leave_cover_completed')) AS visible_markers,
    SUM((m.event_type = 'swap_completed' AND
         (s.id IS NULL OR s.deleted_at IS NOT NULL OR s.status <> 'completed'))
        OR (m.event_type = 'duty_adjustment_completed' AND
         (d.id IS NULL OR d.deleted_at IS NOT NULL OR d.status <> 'completed'))) AS source_mismatch,
    SUM(m.event_status <> 'completed') AS unexpected_status
  FROM latest_marker m
  LEFT JOIN swap_requests s ON m.marker_kind = 'swap' AND BINARY s.id = BINARY m.object_id AND BINARY s.group_id = BINARY m.group_id
  LEFT JOIN duty_adjustments d ON m.marker_kind = 'overtime' AND BINARY d.id = BINARY m.object_id AND BINARY d.group_id = BINARY m.group_id
  WHERE m.rn = 1 GROUP BY m.assignment_id
), workflow_evidence AS (
  SELECT a.id,
    EXISTS (SELECT 1 FROM swap_requests s WHERE BINARY s.group_id = BINARY a.group_id
      AND (BINARY s.initiator_assignment_id = BINARY a.id OR BINARY s.target_assignment_id = BINARY a.id)
      AND s.deleted_at IS NULL AND s.status = 'completed') AS completed_swap,
    EXISTS (SELECT 1 FROM duty_adjustments d WHERE BINARY d.group_id = BINARY a.group_id
      AND BINARY d.covered_assignment_id = BINARY a.id AND d.deleted_at IS NULL
      AND d.status = 'completed') AS completed_duty
  FROM visible_assignments a
), facts AS (
  SELECT a.*, e.timeline_events, COALESCE(m.visible_markers, 0) AS markers,
    COALESCE(m.source_mismatch, 0) AS source_mismatch,
    COALESCE(m.unexpected_status, 0) AS unexpected_status,
    w.completed_swap, w.completed_duty,
    (a.actual_membership_id IS NOT NULL AND
      NOT (BINARY a.actual_membership_id <=> BINARY a.planned_membership_id)) AS actual_diff,
    (a.backfill_at IS NOT NULL OR a.backfill_operator_user_id IS NOT NULL) AS backfill_evidence
  FROM visible_assignments a JOIN event_evidence e ON BINARY e.id = BINARY a.id
  JOIN workflow_evidence w ON BINARY w.id = BINARY a.id
  LEFT JOIN marker_evidence m ON BINARY m.assignment_id = BINARY a.id
)
SELECT SUBSTRING(SHA2(group_id, 256), 1, 12) AS group_key, business_date,
  COUNT(*) AS assignment_count,
  SUM(actual_diff OR markers > 0) AS changed_source_count,
  SUM(actual_diff AND timeline_events = 0) AS difference_without_timeline,
  SUM(actual_diff AND planned_membership_id IS NULL) AS actual_only_snapshot,
  SUM(actual_diff AND backfill_evidence) AS difference_with_backfill,
  SUM(completed_swap OR completed_duty) AS completed_workflow_assignments,
  SUM((completed_swap OR completed_duty) AND timeline_events = 0) AS workflow_without_timeline,
  SUM(source_mismatch > 0) AS marker_source_mismatch,
  SUM(unexpected_status > 0) AS unexpected_marker_status,
  SUM(actual_diff AND timeline_events = 0 AND NOT completed_swap
      AND NOT completed_duty AND NOT backfill_evidence) AS unexplained_snapshot_difference
FROM facts GROUP BY group_id, business_date
HAVING changed_source_count > 0 OR workflow_without_timeline > 0 OR marker_source_mismatch > 0
ORDER BY business_date, group_key;
