import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError } from "./errors";
import { deleteAttachment } from "./file-storage";
import { writeCrmAuditLog } from "./audit";

export const GdprRequestSchema = z.object({
  entityType: z.enum(["COMPANY", "CONTACT", "USER"]),
  entityId: z.string().min(1, "entityId je povinné"),
});

export type GdprRequest = z.infer<typeof GdprRequestSchema>;

export type GdprExport = {
  generatedAt: string;
  entityType: "COMPANY" | "CONTACT" | "USER";
  entity: unknown;
  related: {
    contacts?: unknown[];
    deals?: unknown[];
    activities?: unknown[];
    notes?: unknown[];
    attachments?: unknown[];
    auditLog?: unknown[];
    aiInsights?: unknown[];
  };
};

export async function buildCompanyExport(id: string): Promise<GdprExport> {
  const company = await prisma.crm_companies.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, first_name: true, last_name: true, email: true } },
      contacts: true,
      deals: { include: { deal_contacts: true } },
    },
  });
  if (!company) throw new AppError("NOT_FOUND", "Firma nenalezena.");

  const dealIds = company.deals.map((d) => d.id);
  const contactIds = company.contacts.map((c) => c.id);

  const [activities, notes, attachments, auditLog, aiInsights] = await Promise.all([
    prisma.crm_activities.findMany({
      where: {
        OR: [
          { parent_type: "COMPANY", parent_id: id },
          { parent_type: "CONTACT", parent_id: { in: contactIds } },
          { parent_type: "DEAL", parent_id: { in: dealIds } },
        ],
      },
      orderBy: { date: "desc" },
    }),
    prisma.crm_notes.findMany({
      where: {
        OR: [
          { parent_type: "COMPANY", parent_id: id },
          { parent_type: "CONTACT", parent_id: { in: contactIds } },
          { parent_type: "DEAL", parent_id: { in: dealIds } },
        ],
      },
      orderBy: { created_at: "desc" },
    }),
    prisma.crm_attachments.findMany({
      where: {
        OR: [
          { parent_type: "COMPANY", parent_id: id },
          { parent_type: "CONTACT", parent_id: { in: contactIds } },
          { parent_type: "DEAL", parent_id: { in: dealIds } },
        ],
      },
      select: {
        id: true,
        parent_type: true,
        parent_id: true,
        file_name: true,
        size: true,
        mime: true,
        created_at: true,
      },
    }),
    prisma.crm_audit_log.findMany({
      where: {
        OR: [
          { entity_type: "Company", entity_id: id },
          { entity_type: "Contact", entity_id: { in: contactIds } },
          { entity_type: "Deal", entity_id: { in: dealIds } },
        ],
      },
      orderBy: { created_at: "desc" },
      take: 500,
    }),
    prisma.crm_ai_insights.findMany({
      where: {
        OR: [
          { entity_type: "COMPANY", entity_id: id },
          { entity_type: "DEAL", entity_id: { in: dealIds } },
        ],
      },
      orderBy: { created_at: "desc" },
    }),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    entityType: "COMPANY",
    entity: company,
    related: { activities, notes, attachments, auditLog, aiInsights },
  };
}

export async function buildContactExport(id: string): Promise<GdprExport> {
  const contact = await prisma.crm_contacts.findUnique({
    where: { id },
    include: {
      company: { select: { id: true, name: true } },
      deal_contacts: { include: { deal: { select: { id: true, title: true, stage: true } } } },
    },
  });
  if (!contact) throw new AppError("NOT_FOUND", "Kontakt nenalezen.");

  const dealIds = contact.deal_contacts.map((dc) => dc.deal.id);

  const [activities, notes, auditLog, aiInsights] = await Promise.all([
    prisma.crm_activities.findMany({
      where: { parent_type: "CONTACT", parent_id: id },
      orderBy: { date: "desc" },
    }),
    prisma.crm_notes.findMany({
      where: { parent_type: "CONTACT", parent_id: id },
      orderBy: { created_at: "desc" },
    }),
    prisma.crm_audit_log.findMany({
      where: { entity_type: "Contact", entity_id: id },
      orderBy: { created_at: "desc" },
      take: 200,
    }),
    prisma.crm_ai_insights.findMany({
      where: {
        OR: [
          { entity_type: "CONTACT", entity_id: id },
          { entity_type: "DEAL", entity_id: { in: dealIds } },
        ],
      },
      orderBy: { created_at: "desc" },
    }),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    entityType: "CONTACT",
    entity: contact,
    related: { activities, notes, auditLog, aiInsights },
  };
}

export async function buildUserExport(entityId: string): Promise<GdprExport> {
  const userId = parseInt(entityId, 10);
  if (Number.isNaN(userId) || userId <= 0) {
    throw new AppError("VALIDATION", "Pro USER zadej číselné ID uživatele.");
  }

  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      first_name: true,
      last_name: true,
      role_id: true,
      is_active: true,
      created_at: true,
      updated_at: true,
      last_login: true,
    },
  });
  if (!user) throw new AppError("NOT_FOUND", "Uživatel nenalezen.");

  const [ownedDeals, ownedActivities, notes, auditLog] = await Promise.all([
    prisma.crm_deals.findMany({
      where: { owner_id: userId },
      select: { id: true, title: true, stage: true, value: true },
    }),
    prisma.crm_activities.findMany({
      where: { OR: [{ owner_id: userId }, { assignee_id: userId }] },
      orderBy: { date: "desc" },
      take: 500,
    }),
    prisma.crm_notes.findMany({
      where: { author_id: userId },
      orderBy: { created_at: "desc" },
      take: 500,
    }),
    prisma.crm_audit_log.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      take: 500,
    }),
  ]);

  const ownedDealIds = ownedDeals.map((d) => d.id);
  const aiInsights = await prisma.crm_ai_insights.findMany({
    where: { entity_type: "DEAL", entity_id: { in: ownedDealIds } },
    orderBy: { created_at: "desc" },
  });

  return {
    generatedAt: new Date().toISOString(),
    entityType: "USER",
    entity: user,
    related: {
      deals: ownedDeals,
      activities: ownedActivities,
      notes,
      auditLog,
      aiInsights,
    },
  };
}

async function deleteAttachmentsForParents(
  parents: { parent_type: "COMPANY" | "CONTACT" | "DEAL"; parent_id: string }[]
): Promise<void> {
  if (parents.length === 0) return;
  const attachments = await prisma.crm_attachments.findMany({
    where: { OR: parents.map((p) => ({ parent_type: p.parent_type, parent_id: p.parent_id })) },
  });
  for (const a of attachments) {
    await deleteAttachment(a.path).catch(() => undefined);
  }
  await prisma.crm_attachments.deleteMany({
    where: { id: { in: attachments.map((a) => a.id) } },
  });
}

export async function cascadeDeleteCompany(companyId: string, adminUserId: number): Promise<void> {
  const company = await prisma.crm_companies.findUnique({
    where: { id: companyId },
    include: { contacts: { select: { id: true } }, deals: { select: { id: true } } },
  });
  if (!company) throw new AppError("NOT_FOUND", "Firma nenalezena.");

  const contactIds = company.contacts.map((c) => c.id);
  const dealIds = company.deals.map((d) => d.id);

  await prisma.crm_activities.deleteMany({
    where: {
      OR: [
        { parent_type: "COMPANY", parent_id: companyId },
        { parent_type: "CONTACT", parent_id: { in: contactIds } },
        { parent_type: "DEAL", parent_id: { in: dealIds } },
      ],
    },
  });
  await prisma.crm_notes.deleteMany({
    where: {
      OR: [
        { parent_type: "COMPANY", parent_id: companyId },
        { parent_type: "CONTACT", parent_id: { in: contactIds } },
        { parent_type: "DEAL", parent_id: { in: dealIds } },
      ],
    },
  });
  await deleteAttachmentsForParents([
    { parent_type: "COMPANY", parent_id: companyId },
    ...contactIds.map((id) => ({ parent_type: "CONTACT" as const, parent_id: id })),
    ...dealIds.map((id) => ({ parent_type: "DEAL" as const, parent_id: id })),
  ]);
  await prisma.crm_ai_insights.deleteMany({
    where: {
      OR: [
        { entity_type: "COMPANY", entity_id: companyId },
        { entity_type: "DEAL", entity_id: { in: dealIds } },
      ],
    },
  });
  await prisma.crm_companies.delete({ where: { id: companyId } });

  await writeCrmAuditLog({
    user_id: adminUserId,
    entity_type: "Company",
    entity_id: companyId,
    action: "DELETE",
    diff: { gdpr: true },
  });
}

export async function cascadeDeleteContact(contactId: string, adminUserId: number): Promise<void> {
  const contact = await prisma.crm_contacts.findUnique({ where: { id: contactId } });
  if (!contact) throw new AppError("NOT_FOUND", "Kontakt nenalezen.");

  await prisma.crm_activities.deleteMany({
    where: { parent_type: "CONTACT", parent_id: contactId },
  });
  await prisma.crm_notes.deleteMany({
    where: { parent_type: "CONTACT", parent_id: contactId },
  });
  await deleteAttachmentsForParents([{ parent_type: "CONTACT", parent_id: contactId }]);
  await prisma.crm_ai_insights.deleteMany({
    where: { entity_type: "CONTACT", entity_id: contactId },
  });
  await prisma.crm_contacts.delete({ where: { id: contactId } });

  await writeCrmAuditLog({
    user_id: adminUserId,
    entity_type: "Contact",
    entity_id: contactId,
    action: "DELETE",
    diff: { gdpr: true },
  });
}
