import { prisma } from "@/lib/db";
import type { ParsedMessage } from "./mail-parser";

const INTERNAL_DOMAIN = "integraf.cz";

export interface ParentMatch {
  parentType: "CONTACT" | "COMPANY";
  parentId: string;
}

export async function matchParent(msg: ParsedMessage): Promise<ParentMatch | null> {
  const candidates =
    msg.direction === "outgoing" ? msg.recipientEmails : [msg.fromEmail, ...msg.recipientEmails];

  const external = candidates
    .map((e) => e.toLowerCase())
    .filter((e) => !e.endsWith(`@${INTERNAL_DOMAIN}`));

  if (external.length === 0) return null;

  for (const email of external) {
    const contact = await prisma.crm_contacts.findFirst({
      where: { email: { equals: email } },
      select: { id: true },
    });
    if (contact) return { parentType: "CONTACT", parentId: contact.id };
  }

  const firstEmail = external[0];
  if (!firstEmail) return null;
  const domain = firstEmail.split("@")[1];
  if (!domain) return null;

  const domainContact = await prisma.crm_contacts.findFirst({
    where: { email: { endsWith: `@${domain}` } },
    select: { company_id: true },
  });
  if (domainContact) return { parentType: "COMPANY", parentId: domainContact.company_id };

  return null;
}
