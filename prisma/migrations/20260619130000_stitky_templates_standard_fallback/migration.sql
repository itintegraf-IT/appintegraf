-- Pending šablony: dočasný fallback na layout Standard (stejná mřížka a renderer)
SET NAMES utf8mb4;

UPDATE `stitky_templates`
SET `layout_status` = 'ready', `component_key` = 'standard'
WHERE `layout_status` = 'pending_layout';
