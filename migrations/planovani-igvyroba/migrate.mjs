#!/usr/bin/env node
/**
 * Migrace dat z igvyroba (PlanovaniVyroby) do appintegraf.
 *
 * Spuštění: npm run migrate:planovani  |  npm run migrate:idvyroba
 *
 * Konfigurace: .env → SOURCE_DATABASE_URL (nebo IDVYROBA_DATABASE_URL) + DATABASE_URL,
 * případně úprava migrations/planovani-igvyroba/config.mjs (výchozí zdroj: igvyroba).
 */
import mariadb from "mariadb";
import config from "./config.mjs";

// Názvy tabulek v igvyroba – Prisma default
const SOURCE_TABLES = {
  block: ["Block", "block"],
  codebook: ["CodebookOption", "codebookoption"],
  company: ["CompanyDay", "companyday"],
};

async function tryTable(conn, names) {
  for (const name of names) {
    try {
      await conn.query(`SELECT 1 FROM \`${name}\` LIMIT 1`);
      return name;
    } catch {
      /* next */
    }
  }
  return null;
}

async function run() {
  const { source: src, target: tgt } = config;

  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  Migrace: igvyroba → appintegraf (Plánování výroby)       ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("");
  console.log("📤 Zdroj:  ", src.database, "@", src.host + ":" + src.port);
  console.log("📥 Cíl:    ", tgt.database, "@", tgt.host + ":" + tgt.port);
  console.log("");

  let sourceConn;
  let targetConn;

  try {
    sourceConn = await mariadb.createConnection({
      ...src,
      connectTimeout: 15000,
      allowPublicKeyRetrieval: true,
    });
    console.log("   ✓ Připojeno ke zdroji (" + src.database + ")");

    targetConn = await mariadb.createConnection({
      ...tgt,
      connectTimeout: 15000,
      allowPublicKeyRetrieval: true,
    });
    console.log("   ✓ Připojeno k cíli (" + tgt.database + ")");
    console.log("");

    const blockTable = await tryTable(sourceConn, SOURCE_TABLES.block);
    const codebookTable = await tryTable(sourceConn, SOURCE_TABLES.codebook);
    const companyTable = await tryTable(sourceConn, SOURCE_TABLES.company);

    if (!blockTable || !codebookTable || !companyTable) {
      console.error("❌ Některé tabulky nebyly nalezeny ve zdrojové databázi:");
      if (!blockTable) console.error("   - Block / block");
      if (!codebookTable) console.error("   - CodebookOption / codebookoption");
      if (!companyTable) console.error("   - CompanyDay / companyday");
      process.exit(1);
    }

    console.log("📋 Tabulky zdroje:", blockTable, codebookTable, companyTable);
    console.log("");

    // ─── 1. CodebookOption ───────────────────────────────────────────────
    const codebookRows = await sourceConn.query(`SELECT * FROM \`${codebookTable}\``);
    console.log("   CodebookOption:", codebookRows.length, "řádků");

    if (codebookRows.length > 0) {
      await targetConn.query("DELETE FROM planovani_codebook_options");
      for (const r of codebookRows) {
        await targetConn.query(
          `INSERT INTO planovani_codebook_options (category, label, sortOrder, isActive, shortCode, isWarning)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            r.category,
            r.label,
            r.sortOrder ?? 0,
            r.isActive ?? true,
            r.shortCode ?? null,
            r.isWarning ?? false,
          ]
        );
      }
      console.log("   ✅ Importováno do planovani_codebook_options");
    }

    // ─── 2. CompanyDay ───────────────────────────────────────────────────
    const companyRows = await sourceConn.query(`SELECT * FROM \`${companyTable}\``);
    console.log("   CompanyDay:", companyRows.length, "řádků");

    if (companyRows.length > 0) {
      await targetConn.query("DELETE FROM planovani_company_days");
      for (const r of companyRows) {
        await targetConn.query(
          `INSERT INTO planovani_company_days (startDate, endDate, label, createdAt)
           VALUES (?, ?, ?, ?)`,
          [r.startDate, r.endDate, r.label, r.createdAt ?? new Date()]
        );
      }
      console.log("   ✅ Importováno do planovani_company_days");
    }

    // ─── 3. Block ────────────────────────────────────────────────────────
    const blockRows = await sourceConn.query(`SELECT * FROM \`${blockTable}\` ORDER BY id ASC`);
    console.log("   Block:", blockRows.length, "řádků");

    const idMap = {};

    if (blockRows.length > 0) {
      await targetConn.query("DELETE FROM planovani_blocks");

      for (const r of blockRows) {
        const result = await targetConn.query(
          `INSERT INTO planovani_blocks (
            orderNumber, machine, startTime, endTime, type, description, locked,
            deadlineExpedice, dataStatusId, dataStatusLabel, dataRequiredDate, dataOk,
            materialStatusId, materialStatusLabel, materialRequiredDate, materialOk,
            barvyStatusId, barvyStatusLabel, lakStatusId, lakStatusLabel, specifikace,
            recurrenceType, recurrenceParentId, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            r.orderNumber,
            r.machine,
            r.startTime,
            r.endTime,
            r.type ?? "ZAKAZKA",
            r.description ?? null,
            r.locked ?? false,
            r.deadlineExpedice ?? null,
            r.dataStatusId ?? null,
            r.dataStatusLabel ?? null,
            r.dataRequiredDate ?? null,
            r.dataOk ?? false,
            r.materialStatusId ?? null,
            r.materialStatusLabel ?? null,
            r.materialRequiredDate ?? null,
            r.materialOk ?? false,
            r.barvyStatusId ?? null,
            r.barvyStatusLabel ?? null,
            r.lakStatusId ?? null,
            r.lakStatusLabel ?? null,
            r.specifikace ?? null,
            r.recurrenceType ?? "NONE",
            null,
            r.createdAt ?? new Date(),
            r.updatedAt ?? new Date(),
          ]
        );

        const newId = result.insertId;
        if (newId) idMap[r.id] = newId;
      }

      let updated = 0;
      for (const r of blockRows) {
        if (r.recurrenceParentId != null && idMap[r.recurrenceParentId]) {
          await targetConn.query(
            "UPDATE planovani_blocks SET recurrenceParentId = ? WHERE id = ?",
            [idMap[r.recurrenceParentId], idMap[r.id]]
          );
          updated++;
        }
      }
      if (updated > 0) {
        console.log("   ✅ Importováno do planovani_blocks (" + updated + " vazeb opakování)");
      } else {
        console.log("   ✅ Importováno do planovani_blocks");
      }
    }

    console.log("");
    console.log("═══════════════════════════════════════════════════════════");
    console.log("✅ Migrace dokončena.");
    console.log("═══════════════════════════════════════════════════════════");
  } catch (err) {
    console.error("");
    console.error("❌ Chyba:", err.message);
    if (err.code) console.error("   Kód:", err.code);
    console.error("");
    console.error("Zkontrolujte config.mjs – host, port, user, password, database.");
    process.exit(1);
  } finally {
    if (sourceConn) await sourceConn.end();
    if (targetConn) await targetConn.end();
  }
}

run();
