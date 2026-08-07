INSERT INTO `workflow_sequence_allocations` (`allocated_at`)
SELECT `created_at`
FROM (
  SELECT `id`, `created_at`, 0 AS `workflow_kind`
  FROM `swap_requests`
  UNION ALL
  SELECT `id`, `created_at`, 1 AS `workflow_kind`
  FROM `duty_adjustments`
) AS `existing_workflows`
ORDER BY `created_at` ASC, `workflow_kind` ASC, `id` ASC;
