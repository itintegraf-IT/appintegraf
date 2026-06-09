import { requireCrmRead, requireCrmWrite, requireCrmAdmin } from "@/lib/crm/guards";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { canEditCompany } from "@/lib/crm/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CompanyDetailActions } from "@/components/crm/CompanyDetailActions";
import { ActivitiesTimeline } from "@/components/crm/ActivitiesTimeline";
import { ActivityForm } from "@/components/crm/activities/ActivityForm";
import { NoteForm } from "@/components/crm/NoteForm";
import { NotesTimeline } from "@/components/crm/NotesTimeline";
import { AttachmentUpload } from "@/components/crm/AttachmentUpload";
import { AttachmentList } from "@/components/crm/AttachmentList";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { EntityDetailLayout } from "@/components/crm/layout/EntityDetailLayout";
import { RelationsSection } from "@/components/crm/layout/RelationsSection";
import { CollapsibleFormSection } from "@/components/crm/CollapsibleFormSection";
import { UserAvatar } from "@/components/crm/UserAvatar";
import { CompanyNewDealButton } from "@/components/crm/deals/CompanyNewDealButton";
import { Users, TrendingUp, Plus } from "lucide-react";
import { crmUserDisplayName, serializeCrmUsers, toMentionUser } from "@/lib/crm/users";

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCrmRead();
  const { id } = await params;
  const company = await prisma.crm_companies.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, first_name: true, last_name: true, email: true } },
      contacts: { orderBy: { last_name: "asc" } },
      deals: {
        orderBy: { updated_at: "desc" },
        include: { owner: { select: { first_name: true, last_name: true, email: true } } },
      },
    },
  });
  if (!company) notFound();

  const [activities, users, notes, attachments, categories, lost_reasons] = await Promise.all([
    prisma.crm_activities.findMany({
      where: { parent_type: "COMPANY", parent_id: company.id },
      include: {
        owner: { select: { id: true, first_name: true, last_name: true, email: true } },
        assignee: { select: { id: true, first_name: true, last_name: true, email: true } },
      },
      orderBy: { date: "desc" },
      take: 50,
    }),
    prisma.users.findMany({ select: { id: true, first_name: true, last_name: true, email: true }, orderBy: [{ last_name: "asc" }, { first_name: "asc" }] }),
    prisma.crm_notes.findMany({
      where: { parent_type: "COMPANY", parent_id: company.id },
      include: { author: { select: { id: true, first_name: true, last_name: true, email: true } } },
      orderBy: { created_at: "desc" },
      take: 50,
    }),
    prisma.crm_attachments.findMany({
      where: { parent_type: "COMPANY", parent_id: company.id },
      include: { uploader: { select: { first_name: true, last_name: true, email: true } } },
      orderBy: { created_at: "desc" },
    }),
    prisma.crm_deal_categories.findMany({
      where: { active: true },
      orderBy: [{ sort_order: "asc" }, { label: "asc" }],
      select: { id: true, code: true, label: true, color: true },
    }),
    prisma.crm_lost_reasons.findMany({ where: { active: true }, orderBy: { label: "asc" }, select: { code: true, label: true } }),
  ]);

  const usersForUi = serializeCrmUsers(users);
  const mentionUsers = users.map(toMentionUser);

  const subtitle = (
    <div className="flex flex-wrap items-center gap-2">
      {company.ico ? <span>IČO {company.ico}</span> : null}
      {company.dic ? <span>· DIČ {company.dic}</span> : null}
      {company.segment ? <Badge variant="secondary">{company.segment}</Badge> : null}
    </div>
  );

  return (
    <div className="p-6">
      <EntityDetailLayout
        title={company.name}
        subtitle={subtitle}
        actions={<CompanyDetailActions id={company.id} name={company.name} canEdit={canEditCompany(user, company)} />}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Detaily</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Adresa:</span> {company.address ?? "—"}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Owner:</span>
                {company.owner ? (
                  <>
                    <UserAvatar user={company.owner} size="sm" />
                    <span>{crmUserDisplayName(company.owner)}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">(bez vlastníka)</span>
                )}
              </div>
              <div>
                <span className="text-muted-foreground">Vytvořeno:</span>{" "}
                {company.created_at.toLocaleString("cs-CZ")}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Statistika</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div>
                Kontaktů: <b>{company.contacts.length}</b>
              </div>
              <div>
                Dealů: <b>{company.deals.length}</b>
              </div>
            </CardContent>
          </Card>
        </div>

        <RelationsSection
          title="Kontakty"
          count={company.contacts.length}
          action={
            user.role !== "VIEWER" ? (
              <Button asChild size="sm" variant="outline">
                <Link href={`/crm/contacts/new?company_id=${company.id}`}>
                  <Plus className="mr-1 size-4" strokeWidth={1.75} />
                  Nový kontakt
                </Link>
              </Button>
            ) : null
          }
        >
          {company.contacts.length === 0 ? (
            <EmptyState icon={Users} title="Žádné kontakty" description="Přidej první kontakt k této firmě." />
          ) : (
            <ul className="space-y-1 text-sm">
              {company.contacts.map((c) => (
                <li key={c.id}>
                  <Link href={`/crm/contacts/${c.id}`} className="font-medium text-foreground hover:underline">
                    {c.first_name} {c.last_name}
                  </Link>
                  {c.role ? <span className="text-muted-foreground"> · {c.role}</span> : null}
                  {c.email ? <span className="text-muted-foreground"> · {c.email}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </RelationsSection>

        <RelationsSection
          title="Dealy"
          count={company.deals.length}
          action={
            user.role !== "VIEWER" ? (
              <CompanyNewDealButton
                company={{ id: company.id, name: company.name }}
                categories={categories}
                lost_reasons={lost_reasons}
              />
            ) : null
          }
        >
          {company.deals.length === 0 ? (
            <EmptyState icon={TrendingUp} title="Žádné dealy" description="Založ první deal pro tuto firmu." />
          ) : (
            <ul className="space-y-1 text-sm">
              {company.deals.map((d) => (
                <li key={d.id}>
                  <Link href={`/crm/deals/${d.id}`} className="font-medium text-foreground hover:underline">
                    {d.title}
                  </Link>
                  <span className="text-muted-foreground">
                    {" "}
                    · {d.stage} · {Number(d.value).toLocaleString("cs-CZ")} Kč
                  </span>
                </li>
              ))}
            </ul>
          )}
        </RelationsSection>

        <RelationsSection title="Aktivity">
          {user.role !== "VIEWER" ? (
            <CollapsibleFormSection label="Přidat aktivitu">
              <ActivityForm mode={{ kind: "create", parent_type: "COMPANY", parent_id: company.id }} users={usersForUi} />
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
              <NoteForm parent_type="COMPANY" parent_id={company.id} />
            </CollapsibleFormSection>
          ) : null}
          <NotesTimeline notes={notes} users={mentionUsers} currentUser={{ id: user.id, role: user.role }} />
        </RelationsSection>

        <RelationsSection title="Přílohy">
          {user.role !== "VIEWER" ? (
            <CollapsibleFormSection label="Nahrát přílohu">
              <AttachmentUpload parent_type="COMPANY" parent_id={company.id} />
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
