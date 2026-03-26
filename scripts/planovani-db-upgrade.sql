-- Migrace modulu Plánování výroby na verzi PlanovaniVyroby (březen 2026)
-- Spusťte ručně proti MariaDB/MySQL databázi aplikace.

ALTER TABLE planovani_blocks
  ADD COLUMN blockVariant VARCHAR(32) NOT NULL DEFAULT 'STANDARD' AFTER type,
  ADD COLUMN materialNote TEXT NULL AFTER specifikace,
  ADD COLUMN materialNoteByUsername VARCHAR(100) NULL AFTER materialNote,
  ADD COLUMN printCompletedAt DATETIME NULL AFTER recurrenceParentId,
  ADD COLUMN printCompletedByUserId INT NULL AFTER printCompletedAt,
  ADD COLUMN printCompletedByUsername VARCHAR(100) NULL AFTER printCompletedByUserId;

ALTER TABLE planovani_blocks ADD INDEX planovani_blocks_recurrenceParentId_idx (recurrenceParentId);

ALTER TABLE planovani_codebook_options
  ADD COLUMN badgeColor VARCHAR(32) NULL AFTER isWarning;

ALTER TABLE planovani_company_days
  ADD COLUMN machine VARCHAR(20) NULL AFTER label;

CREATE TABLE planovani_machine_work_hours (
  id INT NOT NULL AUTO_INCREMENT,
  machine VARCHAR(20) NOT NULL,
  dayOfWeek INT NOT NULL,
  startHour INT NOT NULL,
  endHour INT NOT NULL,
  isActive TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY planovani_machine_work_hours_machine_dayOfWeek_key (machine, dayOfWeek),
  KEY planovani_machine_work_hours_machine_idx (machine)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE planovani_machine_schedule_exceptions (
  id INT NOT NULL AUTO_INCREMENT,
  machine VARCHAR(20) NOT NULL,
  date DATETIME NOT NULL,
  startHour INT NOT NULL,
  endHour INT NOT NULL,
  isActive TINYINT(1) NOT NULL DEFAULT 1,
  label VARCHAR(200) NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY planovani_machine_schedule_exceptions_machine_date_key (machine, date),
  KEY planovani_machine_schedule_exceptions_date_idx (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Volitelně: výchozí směny 6–22 hod pro pracovní dny (po–pá), víkendy vypnuto — upravte podle provozu.
-- INSERT INTO planovani_machine_work_hours (machine, dayOfWeek, startHour, endHour, isActive) VALUES
-- ('XL_105', 1, 6, 22, 1), ('XL_105', 2, 6, 22, 1), ('XL_105', 3, 6, 22, 1), ('XL_105', 4, 6, 22, 1), ('XL_105', 5, 6, 22, 1), ('XL_105', 6, 0, 24, 0), ('XL_105', 0, 0, 24, 0),
-- ('XL_106', 1, 6, 22, 1), ('XL_106', 2, 6, 22, 1), ('XL_106', 3, 6, 22, 1), ('XL_106', 4, 6, 22, 1), ('XL_106', 5, 6, 22, 1), ('XL_106', 6, 0, 24, 0), ('XL_106', 0, 0, 24, 0);
