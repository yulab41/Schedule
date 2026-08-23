-- P5 narrows the manual scheduling boundary without truncating persisted data.
-- Active violations must stop the release before any constraint is replaced.
DROP PROCEDURE IF EXISTS `_assert_p5_manual_schedule_limits`;
--> statement-breakpoint
CREATE PROCEDURE `_assert_p5_manual_schedule_limits`()
BEGIN
  IF EXISTS (
    SELECT 1
    FROM `manual_schedule_templates` AS `template`
    WHERE `template`.`deleted_at` IS NULL
      AND `template`.`cycle_days` NOT BETWEEN 1 AND 30
    LIMIT 1
  ) OR EXISTS (
    SELECT 1
    FROM `manual_schedule_template_members` AS `member`
    INNER JOIN `manual_schedule_templates` AS `template`
      ON `template`.`id` = `member`.`template_id`
     AND `template`.`deleted_at` IS NULL
    WHERE `member`.`deleted_at` IS NULL
    GROUP BY `member`.`template_id`
    HAVING COUNT(*) > 20
    LIMIT 1
  ) OR EXISTS (
    SELECT 1
    FROM `manual_schedule_cells` AS `cell`
    INNER JOIN `manual_schedule_templates` AS `template`
      ON `template`.`id` = `cell`.`template_id`
     AND `template`.`deleted_at` IS NULL
    WHERE `cell`.`deleted_at` IS NULL
    GROUP BY `cell`.`template_id`
    HAVING COUNT(*) > 600
    LIMIT 1
  ) OR EXISTS (
    SELECT 1
    FROM `manual_schedule_cells` AS `cell`
    WHERE `cell`.`deleted_at` IS NULL
      AND `cell`.`cycle_day` NOT BETWEEN 1 AND 30
    LIMIT 1
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'P5 manual schedule limits: persisted data exceeds 20 members, 30 days, or 600 cells';
  END IF;
END;
--> statement-breakpoint
CALL `_assert_p5_manual_schedule_limits`();
--> statement-breakpoint
DROP PROCEDURE `_assert_p5_manual_schedule_limits`;
--> statement-breakpoint

ALTER TABLE `manual_schedule_templates`
  DROP CHECK `manual_schedule_templates_cycle_days_check`,
  ADD CONSTRAINT `manual_schedule_templates_cycle_days_check`
    CHECK (`deleted_at` IS NOT NULL OR `cycle_days` BETWEEN 1 AND 30);
--> statement-breakpoint

ALTER TABLE `manual_schedule_cells`
  DROP CHECK `manual_schedule_cells_cycle_day_check`,
  ADD CONSTRAINT `manual_schedule_cells_cycle_day_check`
    CHECK (`deleted_at` IS NOT NULL OR `cycle_day` BETWEEN 1 AND 30);
