-- Číslo zakázky pro párování IML objednávek s jiným systémem
ALTER TABLE `iml_orders`
  ADD COLUMN `job_number` VARCHAR(50) NULL AFTER `order_number`;

CREATE INDEX `iml_orders_job_number_idx` ON `iml_orders`(`job_number`);
