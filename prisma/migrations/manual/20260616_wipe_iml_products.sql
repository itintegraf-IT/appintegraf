-- =============================================================================
-- DESTRUKTIVNÍ: kompletní vymazání katalogu IML produktů a navázaných dat
-- =============================================================================
-- Co se smaže:
--   iml_order_items, iml_inquiry_items (položky odkazující na produkt)
--   iml_product_colors, iml_product_files (barvy, verzované PDF)
--   iml_products (včetně image_data, pdf_data, custom_data)
--
-- Co zůstane:
--   iml_customers, iml_orders, iml_inquiries (hlavičky bez položek),
--   iml_pantone_colors, iml_foils, materials, audit_log, …
--
-- Před spuštěním: záloha celé DB (mysqldump). Viz docs/IML_WIPE_PRODUCTS.md
--
-- Spuštění:
--   ./scripts/wipe-iml-products.sh
--   nebo: mysql … < prisma/migrations/manual/20260616_wipe_iml_products.sql
-- =============================================================================

SELECT '=== POČTY PŘED MAZÁNÍM ===' AS section;

SELECT COUNT(*) AS cnt_products FROM iml_products;
SELECT COUNT(*) AS cnt_order_items FROM iml_order_items;
SELECT COUNT(*) AS cnt_inquiry_items FROM iml_inquiry_items;
SELECT COUNT(*) AS cnt_product_files FROM iml_product_files;
SELECT COUNT(*) AS cnt_product_colors FROM iml_product_colors;

START TRANSACTION;

-- FK: iml_order_items.product_id -> iml_products (RESTRICT)
DELETE oi
FROM iml_order_items oi
INNER JOIN iml_products p ON oi.product_id = p.id;

-- FK: iml_inquiry_items.product_id -> iml_products (RESTRICT)
DELETE ii
FROM iml_inquiry_items ii
INNER JOIN iml_products p ON ii.product_id = p.id;

-- Explicitní wipe (CASCADE by šlo i přes DELETE FROM iml_products)
DELETE FROM iml_product_colors;
DELETE FROM iml_product_files;

DELETE FROM iml_products;

COMMIT;

SELECT '=== POČTY PO MAZÁNÍ (očekáváno 0) ===' AS section;

SELECT COUNT(*) AS cnt_products_after FROM iml_products;
SELECT COUNT(*) AS cnt_order_items_after FROM iml_order_items;
SELECT COUNT(*) AS cnt_inquiry_items_after FROM iml_inquiry_items;
SELECT COUNT(*) AS cnt_product_files_after FROM iml_product_files;
SELECT COUNT(*) AS cnt_product_colors_after FROM iml_product_colors;

-- Volitelně: smazat objednávky/poptávky bez položek (odkomentujte po kontrole)
-- DELETE o FROM iml_orders o
-- WHERE NOT EXISTS (SELECT 1 FROM iml_order_items oi WHERE oi.order_id = o.id);
-- DELETE i FROM iml_inquiries i
-- WHERE NOT EXISTS (SELECT 1 FROM iml_inquiry_items ii WHERE ii.inquiry_id = i.id);
