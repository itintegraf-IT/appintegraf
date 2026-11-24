-- Per-user UI preferences (JSON): list columns, widths, etc.
ALTER TABLE `users` ADD COLUMN `ui_prefs` LONGTEXT NULL;
