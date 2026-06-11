-- Schvalovací krok ceny u maket (plotr)
ALTER TABLE makety
  ADD COLUMN quote_price DECIMAL(12, 2) NULL AFTER status,
  ADD COLUMN quote_production_description TEXT NULL AFTER quote_price,
  ADD COLUMN quote_submitted_at DATETIME NULL AFTER quote_production_description,
  ADD COLUMN quote_submitted_by INT NULL AFTER quote_submitted_at,
  ADD COLUMN rejection_reason TEXT NULL AFTER quote_submitted_by;

ALTER TABLE makety
  ADD CONSTRAINT makety_quote_submitted_by_fk
  FOREIGN KEY (quote_submitted_by) REFERENCES users(id)
  ON DELETE SET NULL ON UPDATE NO ACTION;
