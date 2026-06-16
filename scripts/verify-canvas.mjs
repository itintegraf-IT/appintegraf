#!/usr/bin/env node
/**
 * Ověření @napi-rs/canvas na serveru (Linux produkce).
 * Použití: npm run verify:canvas
 */
import { createRequire } from "node:module";
import { join } from "node:path";

const root = process.cwd();
const errors = [];

try {
  const mod = await import("@napi-rs/canvas");
  const c = mod.createCanvas(8, 8);
  const buf = await c.encode("jpeg", 80);
  console.log("OK: dynamic import, JPEG", buf.length, "B");
  process.exit(0);
} catch (e) {
  errors.push(`import: ${e instanceof Error ? e.message : e}`);
}

try {
  const req = createRequire(join(root, "package.json"));
  const mod = req("@napi-rs/canvas");
  const c = mod.createCanvas(8, 8);
  console.log("OK: require from app root, createCanvas =", typeof c.encode);
  process.exit(0);
} catch (e) {
  errors.push(`require: ${e instanceof Error ? e.message : e}`);
}

console.error("CHYBA: @napi-rs/canvas není dostupný");
for (const err of errors) console.error(" -", err);
console.error("\nZkuste: npm install --legacy-peer-deps && npm run verify:canvas");
process.exit(1);
