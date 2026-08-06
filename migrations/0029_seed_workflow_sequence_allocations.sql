INSERT INTO `workflow_sequence_allocations` (`allocated_at`)
SELECT `created_at`
FROM (
  SELECT `created_at`
  FROM `swap_requests`
  UNION ALL
  SELECT `created_at`
  FROM `duty_adjustments`
) AS `existing_workflows`;
