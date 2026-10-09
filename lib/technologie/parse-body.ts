import { prisma } from "@/lib/db";

export async function parseOptionalSheetTypeId(
  raw: unknown
): Promise<{ ok: true; value: number | null } | { ok: false; error: string }> {
  if (raw == null || raw === "") return { ok: true, value: null };
  const d = parseInt(String(raw), 10);
  if (!Number.isFinite(d) || d <= 0) return { ok: false, error: "Neplatný typ archu." };
  const row = await prisma.technologie_sheet_types.findUnique({
    where: { id: d },
    select: { id: true },
  });
  if (!row) return { ok: false, error: "Typ archu nenalezen." };
  return { ok: true, value: d };
}

export async function parseOptionalSheetSizeId(
  raw: unknown
): Promise<{ ok: true; value: number | null } | { ok: false; error: string }> {
  if (raw == null || raw === "") return { ok: true, value: null };
  const d = parseInt(String(raw), 10);
  if (!Number.isFinite(d) || d <= 0) return { ok: false, error: "Neplatná velikost archu." };
  const row = await prisma.technologie_sheet_sizes.findUnique({
    where: { id: d },
    select: { id: true },
  });
  if (!row) return { ok: false, error: "Velikost archu nenalezena." };
  return { ok: true, value: d };
}

export async function parseOptionalPrintMachineId(
  raw: unknown
): Promise<{ ok: true; value: number | null } | { ok: false; error: string }> {
  if (raw == null || raw === "") return { ok: true, value: null };
  const m = parseInt(String(raw), 10);
  if (!Number.isFinite(m) || m <= 0) return { ok: false, error: "Neplatný tiskový stroj." };
  const machine = await prisma.shared_machines.findUnique({
    where: { id: m },
    select: { id: true },
  });
  if (!machine) return { ok: false, error: "Tiskový stroj nenalezen." };
  return { ok: true, value: m };
}
