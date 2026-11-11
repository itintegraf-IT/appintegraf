-- Veřejné hromadné náhledy softproofů IML produktů
CREATE TABLE IF NOT EXISTS `iml_product_preview_shares` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `token_hash` VARCHAR(64) NOT NULL,
  `title` VARCHAR(255) NULL,
  `note` TEXT NULL,
  `sent_to_email` VARCHAR(190) NULL,
  `expires_at` DATETIME NOT NULL,
  `created_by` INT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `iml_product_preview_shares_token_hash` (`token_hash`),
  KEY `idx_iml_preview_shares_expires` (`expires_at`),
  KEY `idx_iml_preview_shares_created_by` (`created_by`),
  CONSTRAINT `iml_preview_shares_user_fk`
    FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `iml_product_preview_share_items` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `share_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `iml_preview_share_items_unique` (`share_id`, `product_id`),
  KEY `idx_iml_preview_share_items_product` (`product_id`),
  CONSTRAINT `iml_preview_share_items_share_fk`
    FOREIGN KEY (`share_id`) REFERENCES `iml_product_preview_shares` (`id`)
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `iml_preview_share_items_product_fk`
    FOREIGN KEY (`product_id`) REFERENCES `iml_products` (`id`)
    ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
