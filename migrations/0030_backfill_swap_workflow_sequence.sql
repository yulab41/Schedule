UPDATE `swap_requests` AS `swap`
JOIN (
  SELECT `id`, ROW_NUMBER() OVER (
    ORDER BY `created_at` ASC, `workflow_kind` ASC, `id` ASC
  ) AS `sequence_number`
  FROM (
    SELECT `id`, `created_at`, 0 AS `workflow_kind`
    FROM `swap_requests`
    UNION ALL
    SELECT `id`, `created_at`, 1 AS `workflow_kind`
    FROM `duty_adjustments`
  ) AS `all_workflows`
) AS `ranked` ON `ranked`.`id` = `swap`.`id`
SET `swap`.`workflow_sequence` = `ranked`.`sequence_number`;
