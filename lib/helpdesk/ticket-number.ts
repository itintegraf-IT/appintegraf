import { prisma } from "@/lib/db";

export async function generateHelpdeskTicketNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `HD-${year}-`;

  const last = await prisma.helpdesk_tickets.findFirst({
    where: { ticket_number: { startsWith: prefix } },
    orderBy: { ticket_number: "desc" },
    select: { ticket_number: true },
  });

  let seq = 1;
  if (last?.ticket_number) {
    const part = last.ticket_number.slice(prefix.length);
    const n = parseInt(part, 10);
    if (!Number.isNaN(n)) seq = n + 1;
  }

  return `${prefix}${String(seq).padStart(5, "0")}`;
}
