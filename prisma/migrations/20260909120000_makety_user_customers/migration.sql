-- Přiřazení IML klientů uživatelům s rolí Prohlížeč klienta (makety/grafika).
CREATE TABLE `makety_user_customers` (
  `user_id` INT NOT NULL,
  `customer_id` INT NOT NULL,
  PRIMARY KEY (`user_id`, `customer_id`),
  INDEX `idx_makety_user_customers_customer` (`customer_id`),
  CONSTRAINT `makety_user_customers_user_fk`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `makety_user_customers_customer_fk`
    FOREIGN KEY (`customer_id`) REFERENCES `iml_customers` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
