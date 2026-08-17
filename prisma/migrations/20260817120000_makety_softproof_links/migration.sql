-- Veřejné odkazy softproofu (jednorázové schválení/zamítnutí klientem)
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `makety_softproof_links` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `token_hash` VARCHAR(64) NOT NULL,
  `maketa_id` INT NOT NULL,
  `file_id` INT NOT NULL,
  `locale` VARCHAR(8) NOT NULL,
  `sent_to_email` VARCHAR(190) NOT NULL,
  `expires_at` DATETIME(0) NOT NULL,
  `used_at` DATETIME(0) NULL,
  `used_action` VARCHAR(20) NULL,
  `reject_reason` TEXT NULL,
  `created_by` INT NOT NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`),
  UNIQUE KEY `makety_softproof_links_token_hash` (`token_hash`),
  INDEX `idx_makety_softproof_links_maketa` (`maketa_id`),
  INDEX `idx_makety_softproof_links_expires` (`expires_at`),
  CONSTRAINT `makety_softproof_links_maketa_fk`
    FOREIGN KEY (`maketa_id`) REFERENCES `makety`(`id`)
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `makety_softproof_links_user_fk`
    FOREIGN KEY (`created_by`) REFERENCES `users`(`id`)
    ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
