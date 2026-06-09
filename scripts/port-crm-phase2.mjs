#!/usr/bin/env node
/**
 * Port Phase 2 core CRM souborů z integraf-crm do APPIntegraf-NEXT.
 * Spuštění: node scripts/port-crm-phase2.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = "c:\\Program Files\\Ampps\\www\\CRM\\integraf-crm\\src";
const DST = join(__dirname, "..");

const FILES = [
  // lib
  ["lib/validators/company.ts", "lib/crm/validators/company.ts"],
  ["lib/validators/contact.ts", "lib/crm/validators/contact.ts"],
  ["lib/validators/deal.ts", "lib/crm/validators/deal.ts"],
  ["lib/validators/activity.ts", "lib/crm/validators/activity.ts"],
  ["lib/validators/note.ts", "lib/crm/validators/note.ts"],
  ["lib/validators/attachment.ts", "lib/crm/validators/attachment.ts"],
  ["lib/deal-filters.ts", "lib/crm/deal-filters.ts"],
  ["lib/deal-stages.ts", "lib/crm/deal-stages.ts"],
  ["lib/deal-number.ts", "lib/crm/deal-number.ts"],
  ["lib/deal-stage-history.ts", "lib/crm/deal-stage-history.ts"],
  ["lib/format-money.ts", "lib/crm/format-money.ts"],
  ["lib/reminder.ts", "lib/crm/reminder.ts"],
  ["lib/table-state.ts", "lib/crm/table-state.ts"],
  ["lib/datetime-input.ts", "lib/crm/datetime-input.ts"],
  ["lib/mentions.ts", "lib/crm/mentions.ts"],
  ["lib/permissions/activity.ts", "lib/crm/permissions/activity.ts"],
  // api
  ["app/api/companies/route.ts", "app/api/crm/companies/route.ts"],
  ["app/api/companies/[id]/route.ts", "app/api/crm/companies/[id]/route.ts"],
  ["app/api/contacts/route.ts", "app/api/crm/contacts/route.ts"],
  ["app/api/contacts/[id]/route.ts", "app/api/crm/contacts/[id]/route.ts"],
  ["app/api/deals/route.ts", "app/api/crm/deals/route.ts"],
  ["app/api/deals/[id]/route.ts", "app/api/crm/deals/[id]/route.ts"],
  ["app/api/deals/[id]/stage/route.ts", "app/api/crm/deals/[id]/stage/route.ts"],
  ["app/api/deals/[id]/duplicate/route.ts", "app/api/crm/deals/[id]/duplicate/route.ts"],
  ["app/api/deal-categories/route.ts", "app/api/crm/deal-categories/route.ts"],
  ["app/api/activities/route.ts", "app/api/crm/activities/route.ts"],
  ["app/api/activities/[id]/route.ts", "app/api/crm/activities/[id]/route.ts"],
  ["app/api/notes/route.ts", "app/api/crm/notes/route.ts"],
  ["app/api/notes/[id]/route.ts", "app/api/crm/notes/[id]/route.ts"],
  ["app/api/attachments/route.ts", "app/api/crm/attachments/route.ts"],
  ["app/api/attachments/[id]/route.ts", "app/api/crm/attachments/[id]/route.ts"],
  ["app/api/attachments/[id]/download/route.ts", "app/api/crm/attachments/[id]/download/route.ts"],
  ["app/api/search/route.ts", "app/api/crm/search/route.ts"],
  ["app/api/ares/[ico]/route.ts", "app/api/crm/ares/[ico]/route.ts"],
  // pages
  ["app/(app)/companies/page.tsx", "app/(dashboard)/crm/companies/page.tsx"],
  ["app/(app)/companies/new/page.tsx", "app/(dashboard)/crm/companies/new/page.tsx"],
  ["app/(app)/companies/[id]/page.tsx", "app/(dashboard)/crm/companies/[id]/page.tsx"],
  ["app/(app)/companies/[id]/edit/page.tsx", "app/(dashboard)/crm/companies/[id]/edit/page.tsx"],
  ["app/(app)/companies/loading.tsx", "app/(dashboard)/crm/companies/loading.tsx"],
  ["app/(app)/companies/[id]/loading.tsx", "app/(dashboard)/crm/companies/[id]/loading.tsx"],
  ["app/(app)/contacts/page.tsx", "app/(dashboard)/crm/contacts/page.tsx"],
  ["app/(app)/contacts/new/page.tsx", "app/(dashboard)/crm/contacts/new/page.tsx"],
  ["app/(app)/contacts/[id]/page.tsx", "app/(dashboard)/crm/contacts/[id]/page.tsx"],
  ["app/(app)/contacts/[id]/edit/page.tsx", "app/(dashboard)/crm/contacts/[id]/edit/page.tsx"],
  ["app/(app)/contacts/loading.tsx", "app/(dashboard)/crm/contacts/loading.tsx"],
  ["app/(app)/deals/page.tsx", "app/(dashboard)/crm/deals/page.tsx"],
  ["app/(app)/deals/kanban/page.tsx", "app/(dashboard)/crm/deals/kanban/page.tsx"],
  ["app/(app)/deals/new/page.tsx", "app/(dashboard)/crm/deals/new/page.tsx"],
  ["app/(app)/deals/[id]/page.tsx", "app/(dashboard)/crm/deals/[id]/page.tsx"],
  ["app/(app)/deals/[id]/edit/page.tsx", "app/(dashboard)/crm/deals/[id]/edit/page.tsx"],
  ["app/(app)/deals/loading.tsx", "app/(dashboard)/crm/deals/loading.tsx"],
  ["app/(app)/deals/kanban/loading.tsx", "app/(dashboard)/crm/deals/kanban/loading.tsx"],
  ["app/(app)/deals/[id]/loading.tsx", "app/(dashboard)/crm/deals/[id]/loading.tsx"],
  ["app/(app)/activities/page.tsx", "app/(dashboard)/crm/activities/page.tsx"],
  ["app/(app)/reminders/page.tsx", "app/(dashboard)/crm/reminders/page.tsx"],
  // components
  ["components/DataTable.tsx", "components/crm/DataTable.tsx"],
  ["components/CompaniesTable.tsx", "components/crm/CompaniesTable.tsx"],
  ["components/ContactsTable.tsx", "components/crm/ContactsTable.tsx"],
  ["components/DealsTable.tsx", "components/crm/DealsTable.tsx"],
  ["components/KanbanBoard.tsx", "components/crm/KanbanBoard.tsx"],
  ["components/KanbanCard.tsx", "components/crm/KanbanCard.tsx"],
  ["components/UserAvatar.tsx", "components/crm/UserAvatar.tsx"],
  ["components/AresLookupButton.tsx", "components/crm/AresLookupButton.tsx"],
  ["components/CompanyDetailActions.tsx", "components/crm/CompanyDetailActions.tsx"],
  ["components/ActivitiesTimeline.tsx", "components/crm/ActivitiesTimeline.tsx"],
  ["components/NotesTimeline.tsx", "components/crm/NotesTimeline.tsx"],
  ["components/NoteForm.tsx", "components/crm/NoteForm.tsx"],
  ["components/NoteRow.tsx", "components/crm/NoteRow.tsx"],
  ["components/AttachmentUpload.tsx", "components/crm/AttachmentUpload.tsx"],
  ["components/AttachmentList.tsx", "components/crm/AttachmentList.tsx"],
  ["components/DatePicker.tsx", "components/crm/DatePicker.tsx"],
  ["components/DateTimePicker.tsx", "components/crm/DateTimePicker.tsx"],
  ["components/DeleteConfirmDialog.tsx", "components/crm/DeleteConfirmDialog.tsx"],
  ["components/CollapsibleFormSection.tsx", "components/crm/CollapsibleFormSection.tsx"],
  ["components/forms/CompanyForm.tsx", "components/crm/forms/CompanyForm.tsx"],
  ["components/forms/ContactForm.tsx", "components/crm/forms/ContactForm.tsx"],
  ["components/forms/DealForm.tsx", "components/crm/forms/DealForm.tsx"],
  ["components/pickers/CompanyPicker.tsx", "components/crm/pickers/CompanyPicker.tsx"],
  ["components/pickers/ContactPicker.tsx", "components/crm/pickers/ContactPicker.tsx"],
  ["components/layout/EntityDetailLayout.tsx", "components/crm/layout/EntityDetailLayout.tsx"],
  ["components/layout/RelationsSection.tsx", "components/crm/layout/RelationsSection.tsx"],
  ["components/activities/ActivityForm.tsx", "components/crm/activities/ActivityForm.tsx"],
  ["components/activities/ActivityEditDialog.tsx", "components/crm/activities/ActivityEditDialog.tsx"],
  ["components/activities/ActivityRowActions.tsx", "components/crm/activities/ActivityRowActions.tsx"],
  ["components/activities/use-activity-actions.ts", "components/crm/activities/use-activity-actions.ts"],
  ["components/activities/hidden-activities-context.tsx", "components/crm/activities/hidden-activities-context.tsx"],
  ["components/deals/DealFilterBar.tsx", "components/crm/deals/DealFilterBar.tsx"],
  ["components/deals/ActiveFilterPills.tsx", "components/crm/deals/ActiveFilterPills.tsx"],
  ["components/deals/DealsEmptyState.tsx", "components/crm/deals/DealsEmptyState.tsx"],
  ["components/deals/DealQuickAddDialog.tsx", "components/crm/deals/DealQuickAddDialog.tsx"],
  ["components/deals/QuickCompanyCreateDialog.tsx", "components/crm/deals/QuickCompanyCreateDialog.tsx"],
  ["components/deals/DealDetailHeader.tsx", "components/crm/deals/DealDetailHeader.tsx"],
  ["components/deals/DealStageChevrons.tsx", "components/crm/deals/DealStageChevrons.tsx"],
  ["components/deals/DealProbabilityCircle.tsx", "components/crm/deals/DealProbabilityCircle.tsx"],
  ["components/deals/DealTabs.tsx", "components/crm/deals/DealTabs.tsx"],
  ["components/deals/DealTimeline.tsx", "components/crm/deals/DealTimeline.tsx"],
  ["components/deals/DealRelations.tsx", "components/crm/deals/DealRelations.tsx"],
  ["components/deals/DealRelationsActivitiesTable.tsx", "components/crm/deals/DealRelationsActivitiesTable.tsx"],
  ["components/deals/DealAddMenu.tsx", "components/crm/deals/DealAddMenu.tsx"],
  ["components/deals/DealActionsMenu.tsx", "components/crm/deals/DealActionsMenu.tsx"],
  ["components/deals/CategoryPicker.tsx", "components/crm/deals/CategoryPicker.tsx"],
  ["components/deals/StageProgressPicker.tsx", "components/crm/deals/StageProgressPicker.tsx"],
  ["components/deals/CompanyNewDealButton.tsx", "components/crm/deals/CompanyNewDealButton.tsx"],
  ["components/deals/DealsListQuickAdd.tsx", "components/crm/deals/DealsListQuickAdd.tsx"],
  ["components/deals/QuickAddButton.tsx", "components/crm/deals/QuickAddButton.tsx"],
  ["components/deals/filters/SearchInput.tsx", "components/crm/deals/filters/SearchInput.tsx"],
  ["components/deals/filters/MineToggle.tsx", "components/crm/deals/filters/MineToggle.tsx"],
  ["components/deals/filters/OwnerPopover.tsx", "components/crm/deals/filters/OwnerPopover.tsx"],
  ["components/deals/filters/CategoryPopover.tsx", "components/crm/deals/filters/CategoryPopover.tsx"],
  ["components/deals/filters/StagePopover.tsx", "components/crm/deals/filters/StagePopover.tsx"],
  ["components/deals/filters/CloseDatePopover.tsx", "components/crm/deals/filters/CloseDatePopover.tsx"],
  ["components/reminders/RemindersPageTabs.tsx", "components/crm/reminders/RemindersPageTabs.tsx"],
  ["components/reminders/RemindersWidgetClient.tsx", "components/crm/reminders/RemindersWidgetClient.tsx"],
  ["components/reminders/ReminderListItem.tsx", "components/crm/reminders/ReminderListItem.tsx"],
  ["components/reminders/ReminderQuickAddDialog.tsx", "components/crm/reminders/ReminderQuickAddDialog.tsx"],
  ["components/reminders/DealReminderButton.tsx", "components/crm/reminders/DealReminderButton.tsx"],
  ["components/reminders/CompanyReminderButton.tsx", "components/crm/reminders/CompanyReminderButton.tsx"],
  ["components/reminders/DealRemindersTab.tsx", "components/crm/reminders/DealRemindersTab.tsx"],
];

const UI_FILES = [
  "table.tsx", "tabs.tsx", "dialog.tsx", "alert-dialog.tsx", "dropdown-menu.tsx",
  "command.tsx", "form.tsx", "scroll-area.tsx", "skeleton.tsx", "empty-state.tsx",
  "card.tsx", "checkbox.tsx", "avatar.tsx", "responsive-dialog.tsx", "responsive-popover.tsx",
  "radio-group.tsx", "slider.tsx", "alert.tsx", "sheet.tsx", "sonner.tsx",
];

function transform(content, relPath) {
  let s = content;

  // imports
  s = s.replaceAll("@/lib/session", "@/lib/crm/session");
  s = s.replaceAll("@/lib/rbac", "@/lib/crm/rbac");
  s = s.replaceAll("@/lib/prisma", "@/lib/db");
  s = s.replaceAll("@/lib/api-utils", "@/lib/crm/api-utils");
  s = s.replaceAll("@/lib/errors", "@/lib/crm/errors");
  s = s.replaceAll("@/lib/validators/", "@/lib/crm/validators/");
  s = s.replaceAll("@/lib/deal-filters", "@/lib/crm/deal-filters");
  s = s.replaceAll("@/lib/deal-stages", "@/lib/crm/deal-stages");
  s = s.replaceAll("@/lib/deal-number", "@/lib/crm/deal-number");
  s = s.replaceAll("@/lib/deal-stage-history", "@/lib/crm/deal-stage-history");
  s = s.replaceAll("@/lib/format-money", "@/lib/crm/format-money");
  s = s.replaceAll("@/lib/reminder", "@/lib/crm/reminder");
  s = s.replaceAll("@/lib/table-state", "@/lib/crm/table-state");
  s = s.replaceAll("@/lib/datetime-input", "@/lib/crm/datetime-input");
  s = s.replaceAll("@/lib/mentions", "@/lib/crm/mentions");
  s = s.replaceAll("@/lib/permissions/activity", "@/lib/crm/permissions/activity");
  s = s.replaceAll("@/lib/ares", "@/lib/crm/ares");
  s = s.replaceAll("@/lib/file-storage", "@/lib/crm/file-storage");

  // components → crm
  s = s.replaceAll("@/components/DataTable", "@/components/crm/DataTable");
  s = s.replaceAll("@/components/CompaniesTable", "@/components/crm/CompaniesTable");
  s = s.replaceAll("@/components/ContactsTable", "@/components/crm/ContactsTable");
  s = s.replaceAll("@/components/DealsTable", "@/components/crm/DealsTable");
  s = s.replaceAll("@/components/KanbanBoard", "@/components/crm/KanbanBoard");
  s = s.replaceAll("@/components/KanbanCard", "@/components/crm/KanbanCard");
  s = s.replaceAll("@/components/UserAvatar", "@/components/crm/UserAvatar");
  s = s.replaceAll("@/components/AresLookupButton", "@/components/crm/AresLookupButton");
  s = s.replaceAll("@/components/CompanyDetailActions", "@/components/crm/CompanyDetailActions");
  s = s.replaceAll("@/components/ActivitiesTimeline", "@/components/crm/ActivitiesTimeline");
  s = s.replaceAll("@/components/NotesTimeline", "@/components/crm/NotesTimeline");
  s = s.replaceAll("@/components/NoteForm", "@/components/crm/NoteForm");
  s = s.replaceAll("@/components/NoteRow", "@/components/crm/NoteRow");
  s = s.replaceAll("@/components/AttachmentUpload", "@/components/crm/AttachmentUpload");
  s = s.replaceAll("@/components/AttachmentList", "@/components/crm/AttachmentList");
  s = s.replaceAll("@/components/DatePicker", "@/components/crm/DatePicker");
  s = s.replaceAll("@/components/DateTimePicker", "@/components/crm/DateTimePicker");
  s = s.replaceAll("@/components/DeleteConfirmDialog", "@/components/crm/DeleteConfirmDialog");
  s = s.replaceAll("@/components/CollapsibleFormSection", "@/components/crm/CollapsibleFormSection");
  s = s.replaceAll("@/components/forms/", "@/components/crm/forms/");
  s = s.replaceAll("@/components/pickers/", "@/components/crm/pickers/");
  s = s.replaceAll("@/components/layout/EntityDetailLayout", "@/components/crm/layout/EntityDetailLayout");
  s = s.replaceAll("@/components/layout/RelationsSection", "@/components/crm/layout/RelationsSection");
  s = s.replaceAll("@/components/activities/", "@/components/crm/activities/");
  s = s.replaceAll("@/components/deals/", "@/components/crm/deals/");
  s = s.replaceAll("@/components/reminders/", "@/components/crm/reminders/");

  // guards
  s = s.replace(/requireRole\(\[["']ADMIN["'],\s*["']SALES["'],\s*["']VIEWER["']\]\)/g, "requireCrmRead()");
  s = s.replace(/requireRole\(\[["']ADMIN["'],\s*["']VIEWER["'],\s*["']SALES["']\]\)/g, "requireCrmRead()");
  s = s.replace(/requireRole\(\[["']ADMIN["'],\s*["']SALES["']\]\)/g, "requireCrmWrite()");
  s = s.replace(/requireRole\(\[["']SALES["'],\s*["']ADMIN["']\]\)/g, "requireCrmWrite()");
  s = s.replace(/requireRole\(\[["']ADMIN["']\]\)/g, "requireCrmAdmin()");
  s = s.replace(/await requireSession\(\)/g, "await requireCrmRead()");
  s = s.replace(/from "@\/lib\/session"/g, 'from "@/lib/crm/guards"');
  s = s.replace(/requireCrmRead\(\)/g, "requireCrmRead()"); // noop after guards import fix

  // fix double import - add guards import if requireCrmWrite used
  if (s.includes("requireCrmWrite") || s.includes("requireCrmRead") || s.includes("requireCrmAdmin")) {
    if (!s.includes("@/lib/crm/guards")) {
      s = `import { requireCrmRead, requireCrmWrite, requireCrmAdmin } from "@/lib/crm/guards";\n` + s;
      s = s.replace(/import \{ requireCrmSession \} from "@\/lib\/crm\/session";\n/g, "");
    }
  }

  // prisma models
  s = s.replaceAll("prisma.company", "prisma.crm_companies");
  s = s.replaceAll("prisma.contact", "prisma.crm_contacts");
  s = s.replaceAll("prisma.dealCategory", "prisma.crm_deal_categories");
  s = s.replaceAll("prisma.dealContact", "prisma.crm_deal_contacts");
  s = s.replaceAll("prisma.deal", "prisma.crm_deals");
  s = s.replaceAll("prisma.activity", "prisma.crm_activities");
  s = s.replaceAll("prisma.note", "prisma.crm_notes");
  s = s.replaceAll("prisma.attachment", "prisma.crm_attachments");
  s = s.replaceAll("prisma.auditLog", "prisma.crm_audit_log");
  s = s.replaceAll("prisma.user", "prisma.users");

  // prisma types
  s = s.replaceAll("Prisma.CompanyWhereInput", "Prisma.crm_companiesWhereInput");
  s = s.replaceAll("Prisma.CompanyOrderByWithRelationInput", "Prisma.crm_companiesOrderByWithRelationInput");
  s = s.replaceAll("Prisma.ContactWhereInput", "Prisma.crm_contactsWhereInput");
  s = s.replaceAll("Prisma.ContactOrderByWithRelationInput", "Prisma.crm_contactsOrderByWithRelationInput");
  s = s.replaceAll("Prisma.DealWhereInput", "Prisma.crm_dealsWhereInput");
  s = s.replaceAll("Prisma.DealOrderByWithRelationInput", "Prisma.crm_dealsOrderByWithRelationInput");
  s = s.replaceAll("Prisma.ActivityWhereInput", "Prisma.crm_activitiesWhereInput");
  s = s.replaceAll("DealStage", "crm_deal_stage");
  s = s.replaceAll("ActivityType", "crm_activity_type");
  s = s.replaceAll("ParentType", "crm_parent_type");
  s = s.replaceAll("AuditAction", "crm_audit_action");

  // snake_case fields (order matters - longer keys first)
  const fieldMap = [
    ["nextActionDate", "next_action_date"],
    ["isDecisionMaker", "is_decision_maker"],
    ["roleInDeal", "role_in_deal"],
    ["externalSource", "external_source"],
    ["insightType", "insight_type"],
    ["invalidatedAt", "invalidated_at"],
    ["completedAt", "completed_at"],
    ["assigneeId", "assignee_id"],
    ["categoryId", "category_id"],
    ["companyId", "company_id"],
    ["entityType", "entity_type"],
    ["entityId", "entity_id"],
    ["parentType", "parent_type"],
    ["parentId", "parent_id"],
    ["externalId", "external_id"],
    ["uploadedBy", "uploaded_by"],
    ["lostReason", "lost_reason"],
    ["closeDate", "close_date"],
    ["firstName", "first_name"],
    ["lastName", "last_name"],
    ["sortOrder", "sort_order"],
    ["fileName", "file_name"],
    ["authorId", "author_id"],
    ["ownerId", "owner_id"],
    ["updatedAt", "updated_at"],
    ["createdAt", "created_at"],
    ["userId", "user_id"],
  ];
  for (const [from, to] of fieldMap) {
    s = s.replaceAll(from, to);
  }

  // routes - careful order
  s = s.replaceAll('"/api/deal-categories', '"/api/crm/deal-categories');
  s = s.replaceAll("'/api/deal-categories", "'/api/crm/deal-categories");
  s = s.replaceAll('"/api/attachments', '"/api/crm/attachments');
  s = s.replaceAll("'/api/attachments", "'/api/crm/attachments");
  s = s.replaceAll('"/api/activities', '"/api/crm/activities');
  s = s.replaceAll("'/api/activities", "'/api/crm/activities");
  s = s.replaceAll('"/api/companies', '"/api/crm/companies');
  s = s.replaceAll("'/api/companies", "'/api/crm/companies");
  s = s.replaceAll('"/api/contacts', '"/api/crm/contacts');
  s = s.replaceAll("'/api/contacts", "'/api/crm/contacts");
  s = s.replaceAll('"/api/deals', '"/api/crm/deals');
  s = s.replaceAll("'/api/deals", "'/api/crm/deals");
  s = s.replaceAll('"/api/notes', '"/api/crm/notes');
  s = s.replaceAll("'/api/notes", "'/api/crm/notes");
  s = s.replaceAll('"/api/search', '"/api/crm/search');
  s = s.replaceAll("'/api/search", "'/api/crm/search");
  s = s.replaceAll('"/api/ares/', '"/api/crm/ares/');
  s = s.replaceAll("'/api/ares/", "'/api/crm/ares/");

  s = s.replaceAll('href={`/companies/', 'href={`/crm/companies/');
  s = s.replaceAll('href="/companies', 'href="/crm/companies');
  s = s.replaceAll("href={'/companies", "href={'/crm/companies");
  s = s.replaceAll('router.push(`/companies', 'router.push(`/crm/companies');
  s = s.replaceAll('router.push("/companies', 'router.push("/crm/companies');
  s = s.replaceAll('href={`/contacts/', 'href={`/crm/contacts/');
  s = s.replaceAll('href="/contacts', 'href="/crm/contacts');
  s = s.replaceAll('router.push(`/contacts', 'router.push(`/crm/contacts');
  s = s.replaceAll('router.push("/contacts', 'router.push("/crm/contacts');
  s = s.replaceAll('href={`/deals/', 'href={`/crm/deals/');
  s = s.replaceAll('href="/deals', 'href="/crm/deals');
  s = s.replaceAll('router.push(`/deals', 'router.push(`/crm/deals');
  s = s.replaceAll('router.push("/deals', 'router.push("/crm/deals');
  s = s.replaceAll('href="/activities', 'href="/crm/activities');
  s = s.replaceAll('href="/reminders', 'href="/crm/reminders');

  // validators owner_id type
  s = s.replace(/owner_id: z\.string\(\)\.cuid\(\)/g, "owner_id: z.number().int()");
  s = s.replace(/owner_id: z\.string\(\)\.cuid\(\)\.optional\(\)\.nullable\(\)/g, "owner_id: z.number().int().optional().nullable()");
  s = s.replace(/assignee_id: z\.string\(\)\.cuid\(\)/g, "assignee_id: z.number().int()");
  s = s.replace(/author_id: z\.string\(\)\.cuid\(\)/g, "author_id: z.number().int()");

  // remove getPrismaAudited - use prisma directly
  s = s.replace(/const p = getPrismaAudited\(user\.id\);/g, "const p = prisma;");
  s = s.replace(/getPrismaAudited, /g, "");
  s = s.replace(/, getPrismaAudited/g, "");
  s = s.replace(/import \{ withApiError, getPrismaAudited \}/g, 'import { withApiError }');
  s = s.replace(/await p\.crm_/g, "await prisma.crm_");

  // user list orderBy
  s = s.replace(/orderBy: \{ name: "asc" \}/g, 'orderBy: [{ last_name: "asc" }, { first_name: "asc" }]');
  s = s.replace(
    /owner: \{ select: \{ id: true, name: true, email: true, image: true \} \}/g,
    "owner: { select: { id: true, first_name: true, last_name: true, email: true } }"
  );
  s = s.replace(
    /owner: \{ select: \{ id: true, name: true, email: true \} \}/g,
    "owner: { select: { id: true, first_name: true, last_name: true, email: true } }"
  );
  s = s.replace(
    /assignee: \{ select: \{ id: true, name: true, email: true \} \}/g,
    "assignee: { select: { id: true, first_name: true, last_name: true, email: true } }"
  );

  // _count relations
  s = s.replaceAll("_count: { select: { contacts: true, deals: true } }", "_count: { select: { crm_contacts: true, crm_deals: true } }");
  s = s.replaceAll("_count.contacts", "_count.crm_contacts");
  s = s.replaceAll("_count.deals", "_count.crm_deals");
  s = s.replaceAll("contacts: true", "crm_contacts: true");
  s = s.replaceAll("deals: true", "crm_deals: true");
  s = s.replaceAll("include: { contacts:", "include: { crm_contacts:");
  s = s.replaceAll("include: { deals:", "include: { crm_deals:");

  // remove AI summary imports if any slipped
  s = s.replace(/import.*DealSummaryCard.*\n/g, "");
  s = s.replace(/<DealSummaryCard[^/]*\/>/g, "");
  s = s.replace(/<DealSummaryCard[\s\S]*?<\/DealSummaryCard>/g, "");

  // remove type Route from next if present (typedRoutes)
  s = s.replace(/import type \{ Route \} from "next";\n/g, "");

  return s;
}

let copied = 0;
let skipped = 0;

for (const [srcRel, dstRel] of FILES) {
  const srcPath = join(SRC, srcRel);
  const dstPath = join(DST, dstRel);
  if (!existsSync(srcPath)) {
    console.warn("[skip] missing:", srcRel);
    skipped++;
    continue;
  }
  const raw = readFileSync(srcPath, "utf8");
  const out = transform(raw, dstRel);
  mkdirSync(dirname(dstPath), { recursive: true });
  writeFileSync(dstPath, out, "utf8");
  copied++;
}

for (const ui of UI_FILES) {
  const srcPath = join(SRC, "components/ui", ui);
  const dstPath = join(DST, "components/ui", ui);
  if (!existsSync(srcPath)) continue;
  if (existsSync(dstPath)) continue;
  const raw = readFileSync(srcPath, "utf8");
  mkdirSync(dirname(dstPath), { recursive: true });
  writeFileSync(dstPath, raw, "utf8");
  copied++;
}

console.log(`[port-crm] copied ${copied}, skipped ${skipped}`);
