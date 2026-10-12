#!/usr/bin/env node
/**
 * Doplní u produktů s shape_id chybějící selected_tool_id / selected_imposition_id
 * a denormalizovaná pole (assembly_code, positions_on_sheet, labels_per_sheet, …).
 *
 * Pravidla (stejná jako bulk-assign / parseImlProductBodyForSave):
 *   • PRIMARY nástroj tvaru (jinak první assignment)
 *   • první montáž nástroje (orderBy id asc)
 *
 * Spuštění:
 *   node scripts/backfill-product-shape-cascade.mjs --dry-run
 *   node scripts/backfill-product-shape-cascade.mjs
 *
 *   npm run iml:backfill-shape-cascade
 */
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import dotenv from "dotenv";

dotenv.config();

const DRY_RUN = process.argv.includes("--dry-run");

function parseDatabaseUrl(url) {
  const u = new URL(url.replace(/^mysql:\/\//, "http://"));
  return {
    host: u.hostname || "localhost",
    port: u.port ? parseInt(u.port, 10) : 3306,
    user: u.username || undefined,
    password: u.password || undefined,
    database: u.pathname?.replace(/^\//, "").split("?")[0] || undefined,
    connectionLimit: 5,
    connectTimeout: 30000,
    allowPublicKeyRetrieval: true,
  };
}

async function resolveDefaultToolAndImposition(prisma, shapeId) {
  const primary = await prisma.iml_shape_tool_assignment.findFirst({
    where: { shape_id: shapeId, priority: "PRIMARY" },
    select: { tool_id: true },
  });
  let toolId = primary?.tool_id ?? null;
  if (toolId == null) {
    const any = await prisma.iml_shape_tool_assignment.findFirst({
      where: { shape_id: shapeId },
      orderBy: { id: "asc" },
      select: { tool_id: true },
    });
    toolId = any?.tool_id ?? null;
  }
  if (toolId == null) return { toolId: null, impositionId: null };

  const firstImp = await prisma.iml_imposition_catalog.findFirst({
    where: { tool_id: toolId },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  return { toolId, impositionId: firstImp?.id ?? null };
}

async function resolveFirstImpositionForTool(prisma, toolId) {
  const firstImp = await prisma.iml_imposition_catalog.findFirst({
    where: { tool_id: toolId },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  return firstImp?.id ?? null;
}

async function buildScalars(prisma, { shapeId, toolId, impositionId }) {
  const data = {};
  const shape = await prisma.iml_shape_catalog.findUnique({
    where: { id: shapeId },
    select: { shape_code: true, width_mm: true, height_mm: true },
  });
  if (!shape) return data;

  data.label_shape_code = shape.shape_code;
  data.format_width_mm = shape.width_mm;
  data.format_height_mm = shape.height_mm;
  data.product_format = `${Number(shape.width_mm)}×${Number(shape.height_mm)}`;

  if (toolId != null) {
    const tool = await prisma.iml_tool_catalog.findUnique({
      where: { id: toolId },
      select: { tool_code_orig: true, tool_code_new: true },
    });
    if (tool) {
      data.die_cut_tool_code = tool.tool_code_orig || tool.tool_code_new;
    }
  }

  if (impositionId != null) {
    const imp = await prisma.iml_imposition_catalog.findUnique({
      where: { id: impositionId },
      select: { imposition_code: true, positions_count: true },
    });
    if (imp) {
      data.assembly_code = imp.imposition_code;
      data.positions_on_sheet = imp.positions_count;
      data.labels_per_sheet = imp.positions_count;
    }
  }

  return data;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Chybí DATABASE_URL v .env");
    process.exit(1);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb(parseDatabaseUrl(url)),
    log: ["error"],
  });

  console.log(
    DRY_RUN
      ? "=== DRY-RUN: backfill product shape cascade ==="
      : "=== BACKFILL: product shape cascade ==="
  );

  try {
    const candidates = await prisma.iml_products.findMany({
      where: {
        shape_id: { not: null },
        OR: [
          { selected_imposition_id: null },
          { assembly_code: null },
          { positions_on_sheet: null },
          { labels_per_sheet: null },
          { selected_tool_id: null },
        ],
      },
      select: {
        id: true,
        shape_id: true,
        selected_tool_id: true,
        selected_imposition_id: true,
        label_shape_code: true,
        assembly_code: true,
      },
      orderBy: { id: "asc" },
    });

    console.log(`Kandidátů: ${candidates.length}`);

    let updated = 0;
    let skipped = 0;

    for (const p of candidates) {
      const shapeId = p.shape_id;
      if (shapeId == null) {
        skipped++;
        continue;
      }

      let toolId = p.selected_tool_id;
      let impositionId = p.selected_imposition_id;

      if (toolId == null) {
        const defaults = await resolveDefaultToolAndImposition(prisma, shapeId);
        toolId = defaults.toolId;
        if (impositionId == null) impositionId = defaults.impositionId;
      } else if (impositionId == null) {
        impositionId = await resolveFirstImpositionForTool(prisma, toolId);
      }

      if (toolId == null && impositionId == null) {
        console.log(`  #${p.id}: bez nástroje/montáže u tvaru ${shapeId} — přeskočeno`);
        skipped++;
        continue;
      }

      const scalars = await buildScalars(prisma, {
        shapeId,
        toolId,
        impositionId,
      });

      const data = {
        ...scalars,
        ...(toolId != null
          ? { iml_tool_catalog: { connect: { id: toolId } } }
          : {}),
        ...(impositionId != null
          ? { iml_imposition_catalog: { connect: { id: impositionId } } }
          : {}),
      };

      console.log(
        `  #${p.id} (${p.label_shape_code ?? "?"}): tool=${toolId ?? "—"} imposition=${impositionId ?? "—"} assembly=${scalars.assembly_code ?? "—"}`
      );

      if (!DRY_RUN) {
        await prisma.iml_products.update({ where: { id: p.id }, data });
      }
      updated++;
    }

    console.log(
      `\nHotovo: ${DRY_RUN ? "by se aktualizovalo" : "aktualizováno"} ${updated}, přeskočeno ${skipped}`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
