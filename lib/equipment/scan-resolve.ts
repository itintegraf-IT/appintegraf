import { prisma } from "@/lib/db";
import {
  decideScanResolution,
  parseEquipmentScanCode,
  type ParsedEquipmentCode,
  type ScanCandidates,
  type ScanResolution,
  type ScanTarget,
} from "@/lib/equipment/scan-code";

/**
 * Jediný vstup pro převod naskenovaného/zadaného kódu na položku nebo místnost
 * (lookup skeneru, přesun, inventura). Pravidla: decideScanResolution.
 */
export async function resolveScanCode(
  raw: string,
  target: ScanTarget
): Promise<{ parsed: ParsedEquipmentCode; resolution: ScanResolution }> {
  const parsed = parseEquipmentScanCode(raw);
  const code = parsed.code;
  if (!code) return { parsed, resolution: { type: "not_found" } };

  const candidates: ScanCandidates = {};
  if (parsed.kind !== "rm") {
    const items = await prisma.equipment_items.findMany({
      where: { OR: [{ asset_tag: code }, { qr_code: code }, { serial_number: code }] },
      select: { id: true, asset_tag: true, qr_code: true, serial_number: true },
      take: 5,
    });
    // Porovnání bez ohledu na velikost písmen, stejně jako collation v DB.
    const same = (v: string | null) => v != null && v.toLowerCase() === code.toLowerCase();
    candidates.itemByTag = items.find((i) => same(i.asset_tag));
    candidates.itemByQr = items.find((i) => same(i.qr_code));
    candidates.itemBySerial = items.find((i) => same(i.serial_number));

    const pool = await prisma.equipment_qr_pool.findFirst({
      where: { OR: [{ qr_code: code }, { asset_tag: code }] },
      select: { id: true, status: true, equipment_id: true },
    });
    if (pool) candidates.pool = { id: pool.id, status: pool.status, equipmentId: pool.equipment_id };
  }
  if (parsed.kind !== "eq") {
    const room = await prisma.equipment_rooms.findFirst({
      where: { is_active: true, OR: [{ qr_code: code }, { code }] },
      select: { id: true },
    });
    if (room) candidates.room = room;
  }

  return { parsed, resolution: decideScanResolution(parsed, candidates, target) };
}
