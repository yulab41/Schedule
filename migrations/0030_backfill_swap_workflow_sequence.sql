-- 历史工作流序列回填：只计算一次全量排名，同时回填 swap_requests 与 duty_adjustments。
-- 排序必须与运行时分配器 allocateWorkflowSequence 的单调语义一致：
-- 创建时间升序、swap（0）先于 duty（1）、id 升序。
-- 0029 的播种顺序与本文件保持一致；新工作流从 workflow_sequence_allocations
-- 自增 ID 继续，因此回填值必须占满 1..N 且不得与未来分配重叠（见 0031 校验）。
CREATE TEMPORARY TABLE `_workflow_sequence_ranked` (
  `id` CHAR(36) NOT NULL,
  `sequence_number` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
INSERT INTO `_workflow_sequence_ranked` (`id`, `sequence_number`)
SELECT `id`, ROW_NUMBER() OVER (
  ORDER BY `created_at` ASC, `workflow_kind` ASC, `id` ASC
) AS `sequence_number`
FROM (
  SELECT `id`, `created_at`, 0 AS `workflow_kind` FROM `swap_requests`
  UNION ALL
  SELECT `id`, `created_at`, 1 AS `workflow_kind` FROM `duty_adjustments`
) AS `all_workflows`;
--> statement-breakpoint
UPDATE `swap_requests` AS `swap`
JOIN `_workflow_sequence_ranked` AS `ranked` ON `ranked`.`id` = `swap`.`id`
SET `swap`.`workflow_sequence` = `ranked`.`sequence_number`;
--> statement-breakpoint
UPDATE `duty_adjustments` AS `adjustment`
JOIN `_workflow_sequence_ranked` AS `ranked` ON `ranked`.`id` = `adjustment`.`id`
SET `adjustment`.`workflow_sequence` = `ranked`.`sequence_number`;
--> statement-breakpoint
DROP TEMPORARY TABLE `_workflow_sequence_ranked`;
