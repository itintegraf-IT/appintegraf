#!/usr/bin/env node
/**
 * Doplní miniatury (JPEG v image_data) z primárního PDF u produktů bez náhledu.
 *
 * Vyžaduje běžící aplikaci a přihlášení administrátora IML (session cookie).
 * Alternativa: POST /api/iml/products/thumbnails/backfill?limit=50 (stejné oprávnění).
 *
 * Spuštění na serveru (po deployi, z localhostu na portu aplikace):
 *   IML_BACKFILL_BASE_URL=http://127.0.0.1:3010 \
 *   IML_BACKFILL_SESSION_COOKIE="next-auth.session-token=..." \
 *   node scripts/iml-backfill-product-thumbnails.mjs
 *
 *   npm run iml:backfill-thumbnails
 *
 * Opakujte, dokud remaining = 0.
 */
const BASE_URL = (process.env.IML_BACKFILL_BASE_URL || "http://127.0.0.1:3010").replace(
  /\/$/,
  ""
);
const COOKIE = process.env.IML_BACKFILL_SESSION_COOKIE || "";
const LIMIT = Math.min(200, Math.max(1, parseInt(process.env.IML_BACKFILL_LIMIT || "50", 10)));
const MAX_ROUNDS = Math.min(500, Math.max(1, parseInt(process.env.IML_BACKFILL_MAX_ROUNDS || "100", 10)));

async function runBatch() {
  const headers = { "Content-Type": "application/json" };
  if (COOKIE) headers.Cookie = COOKIE;

  const res = await fetch(`${BASE_URL}/api/iml/products/thumbnails/backfill?limit=${LIMIT}`, {
    method: "POST",
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

async function main() {
  if (!COOKIE) {
    console.error(
      "Chybí IML_BACKFILL_SESSION_COOKIE – přihlaste se v prohlížeči jako IML admin, zkopírujte cookie next-auth.session-token."
    );
    console.error("Nebo volejte API ručně: POST /api/iml/products/thumbnails/backfill?limit=50");
    process.exit(1);
  }

  let round = 0;
  let totalCreated = 0;

  while (round < MAX_ROUNDS) {
    round++;
    const data = await runBatch();
    totalCreated += data.created ?? 0;
    console.log(
      `Dávka ${round}: zpracováno ${data.processed}, vytvořeno ${data.created}, přeskočeno ${data.skipped}, chyb ${data.failed}, zbývá ~${data.remaining}`
    );
    if (data.errors?.length) {
      for (const e of data.errors.slice(0, 5)) console.warn("  ", e);
    }
    if (!data.remaining || data.remaining <= 0) {
      console.log(`Hotovo. Celkem vytvořeno miniatur: ${totalCreated}`);
      return;
    }
    if ((data.processed ?? 0) === 0) {
      console.log("Žádné další produkty k zpracování.");
      return;
    }
  }

  console.log(`Dosažen limit ${MAX_ROUNDS} dávek. Spusťte skript znovu pro pokračování.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
