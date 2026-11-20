-- Doplnění výsekového zařízení Příklop do číselníku rozkresů
SET NAMES utf8mb4;

INSERT INTO `technologie_die_cut_devices` (`name`, `sort_order`, `is_active`)
SELECT 'Příklop', 40, TRUE
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM `technologie_die_cut_devices` WHERE `name` = 'Příklop'
);
