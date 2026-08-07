-- 0031 原职责（duty_adjustments 回填）已并入 0030；文件名保留以兼容迁移 journal。
-- 本迁移校验历史回填序列与 0029 播种的分配区间一致：
-- 回填最大值超过播种的最大分配 ID（后续自增 ID 会与之重叠），
-- 或序列出现重复时，插入 CHECK 约束失败使迁移报错。
CREATE TEMPORARY TABLE `_workflow_sequence_validation` (
  `ok` TINYINT UNSIGNED NOT NULL,
  CONSTRAINT `workflow_sequence_backfill_overlap_check` CHECK (`ok` = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
INSERT INTO `_workflow_sequence_validation` (`ok`)
SELECT 0
FROM (
  SELECT
    MAX(`workflow_sequence`)
      > COALESCE((SELECT MAX(`id`) FROM `workflow_sequence_allocations`), 0)
      AS `overlaps_future_allocations`,
    COUNT(DISTINCT `workflow_sequence`) <> COUNT(*) AS `has_duplicate_sequences`
  FROM (
    SELECT `workflow_sequence` FROM `swap_requests`
    UNION ALL
    SELECT `workflow_sequence` FROM `duty_adjustments`
  ) AS `all_workflows`
) AS `validation_checks`
WHERE `validation_checks`.`overlaps_future_allocations`
   OR `validation_checks`.`has_duplicate_sequences`;
--> statement-breakpoint
DROP TEMPORARY TABLE `_workflow_sequence_validation`;
