import { prisma } from "@/lib/db";

export async function generateItVendorRequestNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ITV-${year}-`;

  const last = await prisma.it_vendor_requests.findFirst({
    where: { request_number: { startsWith: prefix } },
    orderBy: { request_number: "desc" },
    select: { request_number: true },
  });

  let seq = 1;
  if (last?.request_number) {
    const part = last.request_number.slice(prefix.length);
    const n = parseInt(part, 10);
    if (!Number.isNaN(n)) seq = n + 1;
  }

  return `${prefix}${String(seq).padStart(4, "0")}`;
}
