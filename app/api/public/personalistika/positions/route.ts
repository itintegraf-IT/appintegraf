import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type PublicPositionRow = {
  id: number;
  name: string;
  is_active: number | string | boolean | bigint | null;
};

function isActiveFlag(value: PublicPositionRow["is_active"]): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "bigint") return value !== 0n;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value !== "0" && value.toLowerCase() !== "false";
  return false;
}

export async function GET() {
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT id, name, is_active
       FROM hr_positions
       ORDER BY name ASC`
    )) as PublicPositionRow[];

    const positions = rows
      .filter((r) => isActiveFlag(r.is_active))
      .map((r) => ({ id: r.id, name: r.name }));

    return NextResponse.json({ positions });
  } catch {
    return NextResponse.json({ positions: [] });
  }
}
