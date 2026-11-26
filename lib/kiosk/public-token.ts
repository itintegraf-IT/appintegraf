import { prisma } from "@/lib/db";
import { newKioskPublicToken } from "@/lib/kiosk/upload";

/** Zajistí, že prezentace má public token v active_url. */
export async function ensurePresentationPublicToken(
  presentationId: number
): Promise<string> {
  const row = await prisma.presentations.findUnique({
    where: { id: presentationId },
    select: { active_url: true },
  });
  if (!row) throw new Error("Prezentace nenalezena");
  if (row.active_url?.trim()) return row.active_url.trim();

  const token = newKioskPublicToken();
  await prisma.presentations.update({
    where: { id: presentationId },
    data: { active_url: token },
  });
  return token;
}
