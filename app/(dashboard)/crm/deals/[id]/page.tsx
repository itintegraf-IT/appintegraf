import { requireCrmRead, requireCrmWrite, requireCrmAdmin } from "@/lib/crm/guards";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { canEditDeal } from "@/lib/crm/rbac";
import { DealDetailHeader } from "@/components/crm/deals/DealDetailHeader";
import { DealTabs } from "@/components/crm/deals/DealTabs";
import { DealTimeline } from "@/components/crm/deals/DealTimeline";
import { DealRelations } from "@/components/crm/deals/DealRelations";
import { NoteForm } from "@/components/crm/NoteForm";
import { NotesTimeline } from "@/components/crm/NotesTimeline";
import { AttachmentUpload } from "@/components/crm/AttachmentUpload";
import { AttachmentList } from "@/components/crm/AttachmentList";
import { DealRemindersTab, type DealReminderRow } from "@/components/crm/reminders/DealRemindersTab";
import { REMINDER_TYPES, type ReminderType } from "@/lib/crm/reminder";
import { getStageHistory } from "@/lib/crm/deal-stage-history";
import { serializeCrmUsers, toMentionUser } from "@/lib/crm/users";
import { DealSummaryCard } from "@/components/crm/ai/DealSummaryCard";

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCrmRead();
  const { id } = await params;

  const deal = await prisma.crm_deals.findUnique({
    where: { id },
    include: { company: { select: { id: true, name: true } },
      owner: { select: { id: true, first_name: true, last_name: true, email: true } },
      deal_contacts: { include: { contact: true } },
    },
  });
  if (!deal) notFound();

  const canEdit = canEditDeal(user, deal);
  const canDelete = user.role === "ADMIN";

  const [activities, users, notes, attachments, history, stageTransitionLogs] = await Promise.all([
    prisma.crm_activities.findMany({
      where: { parent_type: "DEAL", parent_id: deal.id },
      include: {
        owner: { select: { id: true, first_name: true, last_name: true, email: true } },
        assignee: { select: { id: true, first_name: true, last_name: true, email: true } },
      },
      orderBy: { date: "desc" },
      take: 100,
    }),
    prisma.users.findMany({ select: { id: true, first_name: true, last_name: true, email: true }, orderBy: [{ last_name: "asc" }, { first_name: "asc" }] }),
    prisma.crm_notes.findMany({
      where: { parent_type: "DEAL", parent_id: deal.id },
      include: { author: { select: { id: true, first_name: true, last_name: true, email: true } } },
      orderBy: { created_at: "desc" },
      take: 50,
    }),
    prisma.crm_attachments.findMany({
      where: { parent_type: "DEAL", parent_id: deal.id },
      include: { uploader: { select: { first_name: true, last_name: true, email: true } } },
      orderBy: { created_at: "desc" },
    }),
    getStageHistory(deal.id),
    prisma.crm_audit_log.findMany({
      where: { entity_type: "Deal", entity_id: deal.id, action: "UPDATE" },
      include: { user: { select: { id: true, first_name: true, last_name: true, email: true } } },
      orderBy: { created_at: "desc" },
      take: 100,
    }),
  ]);

  const usersForUi = serializeCrmUsers(users);
  const mentionUsers = users.map(toMentionUser);
  const attachmentsForUI = attachments.map((a) => ({
    ...a,
    created_at: a.created_at.toISOString(),
    canDelete: user.role === "ADMIN" || a.uploaded_by === user.id,
  }));

  // Reminders pro tento deal (filter z activities) — REMINDER_TYPES = [CALL, MEETING, REMINDER]
  const dealReminders: DealReminderRow[] = activities
    .filter((a) => (REMINDER_TYPES as readonly string[]).includes(a.type))
    .map((a) => ({
      id: a.id,
      type: a.type as ReminderType,
      date: a.date.toISOString(),
      note: a.note,
      completed_at: a.completed_at ? a.completed_at.toISOString() : null,
    }));

  const activeRemindersCount = dealReminders.filter((r) => r.completed_at === null).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <DealDetailHeader
        deal={deal}
        history={history}
        canEdit={canEdit}
        canDelete={canDelete}
        users={usersForUi}
        aiSummarySlot={<DealSummaryCard dealId={deal.id} canGenerate={canEdit} />}
      />

      <div className="rounded-3xl border border-border/40 bg-card px-8 py-6 shadow-sm">
        <DealTabs
          timeline={
            <DealTimeline
              dealId={deal.id}
              activities={activities}
              stageLogs={stageTransitionLogs}
              users={usersForUi}
              currentUser={{ id: user.id, role: user.role }}
              canEdit={user.role !== "VIEWER"}
            />
          }
          reminders={
            <DealRemindersTab
              deal={{ id: deal.id, title: deal.title }}
              reminders={dealReminders}
              canAdd={canEdit}
            />
          }
          remindersBadge={activeRemindersCount}
          relations={
            <DealRelations
              dealId={deal.id}
              activities={activities}
              dealContacts={deal.deal_contacts}
              attachments={attachmentsForUI}
              companyName={deal.company.name}
              currentUser={{ id: user.id, role: user.role }}
              users={usersForUi}
            />
          }
          notes={
            <div className="space-y-4">
              {user.role !== "VIEWER" ? <NoteForm parent_type="DEAL" parent_id={deal.id} /> : null}
              <NotesTimeline notes={notes} users={mentionUsers} currentUser={{ id: user.id, role: user.role }} />
            </div>
          }
          attachments={
            <div className="space-y-4">
              {user.role !== "VIEWER" ? <AttachmentUpload parent_type="DEAL" parent_id={deal.id} /> : null}
              <AttachmentList attachments={attachmentsForUI} />
            </div>
          }
        />
      </div>
    </div>
  );
}
