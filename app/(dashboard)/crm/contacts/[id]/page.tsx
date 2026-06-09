import { requireCrmRead, requireCrmWrite, requireCrmAdmin } from "@/lib/crm/guards";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { canEditCompany } from "@/lib/crm/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActivitiesTimeline } from "@/components/crm/ActivitiesTimeline";
import { ActivityForm } from "@/components/crm/activities/ActivityForm";
import { NoteForm } from "@/components/crm/NoteForm";
import { NotesTimeline } from "@/components/crm/NotesTimeline";
import { AttachmentUpload } from "@/components/crm/AttachmentUpload";
import { AttachmentList } from "@/components/crm/AttachmentList";
import { EntityDetailLayout } from "@/components/crm/layout/EntityDetailLayout";
import { serializeCrmUsers, toMentionUser } from "@/lib/crm/users";
import { RelationsSection } from "@/components/crm/layout/RelationsSection";
import { CollapsibleFormSection } from "@/components/crm/CollapsibleFormSection";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireCrmRead();
  const { id } = await params;
  const contact = await prisma.crm_contacts.findUnique({
    where: { id },
    include: { company: true },
  });
  if (!contact) notFound();
  const canEdit = canEditCompany(user, contact.company);

  const [activities, users, notes, attachments] = await Promise.all([
    prisma.crm_activities.findMany({
      where: { parent_type: "CONTACT", parent_id: contact.id },
      include: {
        owner: { select: { id: true, first_name: true, last_name: true, email: true } },
        assignee: { select: { id: true, first_name: true, last_name: true, email: true } },
      },
      orderBy: { date: "desc" },
      take: 50,
    }),
    prisma.users.findMany({ select: { id: true, first_name: true, last_name: true, email: true }, orderBy: [{ last_name: "asc" }, { first_name: "asc" }] }),
    prisma.crm_notes.findMany({
      where: { parent_type: "CONTACT", parent_id: contact.id },
      include: { author: { select: { id: true, first_name: true, last_name: true, email: true } } },
      orderBy: { created_at: "desc" },
      take: 50,
    }),
    prisma.crm_attachments.findMany({
      where: { parent_type: "CONTACT", parent_id: contact.id },
      include: { uploader: { select: { first_name: true, last_name: true, email: true } } },
      orderBy: { created_at: "desc" },
    }),
  ]);

  const usersForUi = serializeCrmUsers(users);
  const mentionUsers = users.map(toMentionUser);

  const subtitle = (
    <div className="flex flex-wrap items-center gap-1">
      <Link
        href={`/crm/companies/${contact.company.id}`}
        className="font-medium text-foreground hover:underline"
      >
        {contact.company.name}
      </Link>
      {contact.role ? <span>· {contact.role}</span> : null}
    </div>
  );

  return (
    <div className="p-6">
      <EntityDetailLayout
        title={`${contact.first_name} ${contact.last_name}`}
        subtitle={subtitle}
        actions={
          canEdit ? (
            <Button asChild variant="outline">
              <Link href={`/crm/contacts/${contact.id}/edit`}>Upravit</Link>
            </Button>
          ) : null
        }
      >
        <Card>
          <CardHeader>
            <CardTitle>Kontaktní údaje</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div>
              E-mail:{" "}
              {contact.email ? (
                <a className="text-foreground hover:underline" href={`mailto:${contact.email}`}>
                  {contact.email}
                </a>
              ) : (
                "—"
              )}
            </div>
            <div>Telefon: {contact.phone ?? "—"}</div>
            <div>Decision maker: {contact.is_decision_maker ? "ano" : "ne"}</div>
          </CardContent>
        </Card>

        <RelationsSection title="Aktivity">
          {user.role !== "VIEWER" ? (
            <CollapsibleFormSection label="Přidat aktivitu">
              <ActivityForm mode={{ kind: "create", parent_type: "CONTACT", parent_id: contact.id }} users={usersForUi} />
            </CollapsibleFormSection>
          ) : null}
          <ActivitiesTimeline
            activities={activities}
            currentUser={{ id: user.id, role: user.role }}
            users={usersForUi}
          />
        </RelationsSection>

        <RelationsSection title="Poznámky">
          {user.role !== "VIEWER" ? (
            <CollapsibleFormSection label="Přidat poznámku">
              <NoteForm parent_type="CONTACT" parent_id={contact.id} />
            </CollapsibleFormSection>
          ) : null}
          <NotesTimeline notes={notes} users={mentionUsers} currentUser={{ id: user.id, role: user.role }} />
        </RelationsSection>

        <RelationsSection title="Přílohy">
          {user.role !== "VIEWER" ? (
            <CollapsibleFormSection label="Nahrát přílohu">
              <AttachmentUpload parent_type="CONTACT" parent_id={contact.id} />
            </CollapsibleFormSection>
          ) : null}
          <AttachmentList
            attachments={attachments.map((a) => ({
              ...a,
              created_at: a.created_at.toISOString(),
              canDelete: user.role === "ADMIN" || a.uploaded_by === user.id,
            }))}
          />
        </RelationsSection>
      </EntityDetailLayout>
    </div>
  );
}
