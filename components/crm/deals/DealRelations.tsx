"use client";

import Link from "next/link";
import { useState } from "react";
import type { crm_activities, crm_contacts, crm_deal_contacts } from "@prisma/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DealRelationsActivitiesTable } from "./DealRelationsActivitiesTable";
import { AttachmentList } from "@/components/crm/AttachmentList";
import type { Role } from "@/lib/crm/rbac";
import type { CrmUserOption } from "@/lib/crm/users";

type ActivityUser = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
};

type ActivityWithOwner = crm_activities & {
  owner: ActivityUser;
};

type AttachmentForUI = {
  id: string;
  file_name: string;
  size: number;
  mime: string;
  created_at: string;
  uploader: { first_name?: string | null; last_name?: string | null; email?: string | null } | null;
  canDelete: boolean;
};

type Props = {
  dealId: string;
  activities: ActivityWithOwner[];
  dealContacts: (crm_deal_contacts & { contact: crm_contacts })[];
  attachments: AttachmentForUI[];
  companyName: string;
  currentUser: { id: number; role: Role };
  users: CrmUserOption[];
};

type View = "activities" | "contacts" | "attachments";

export function DealRelations({ activities, dealContacts, attachments, companyName, currentUser, users }: Props) {
  const [view, setView] = useState<View>("activities");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Select value={view} onValueChange={(v) => setView(v as View)}>
          <SelectTrigger className="w-44 rounded-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="activities">Aktivity</SelectItem>
            <SelectItem value="contacts">Kontakty</SelectItem>
            <SelectItem value="attachments">Přílohy</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {view === "activities" ? (
        <DealRelationsActivitiesTable
          activities={activities}
          companyName={companyName}
          currentUser={currentUser}
          users={users}
        />
      ) : null}

      {view === "contacts" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {dealContacts.length === 0 ? (
            <div className="rounded-2xl bg-muted/20 px-6 py-8 text-center text-sm text-muted-foreground">
              Žádné kontakty.
            </div>
          ) : (
            dealContacts.map((dc) => (
              <Link
                key={dc.contact_id}
                href={`/crm/contacts/${dc.contact_id}`}
                className="block rounded-2xl border border-border/40 bg-card px-4 py-3 shadow-sm transition hover:shadow"
              >
                <div className="font-medium">
                  {dc.contact.first_name} {dc.contact.last_name}
                </div>
                {dc.contact.role ? (
                  <div className="text-xs text-muted-foreground">{dc.contact.role}</div>
                ) : null}
                {dc.contact.email ? (
                  <div className="mt-1 text-sm text-muted-foreground">{dc.contact.email}</div>
                ) : null}
              </Link>
            ))
          )}
        </div>
      ) : null}

      {view === "attachments" ? <AttachmentList attachments={attachments} /> : null}
    </div>
  );
}
