import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { canViewContactVizitka, hasModuleAccess } from "@/lib/auth-utils";
import { buildOutlookContactSignatureHtml, getContactSignatureAssetBaseUrl } from "@/lib/contact-signature-html";
import { prisma } from "@/lib/db";
import { mergeUserEmails } from "@/lib/merge-user-emails";
import { ArrowLeft, Mail, Phone, Building2, Pencil, QrCode } from "lucide-react";
import { ContactDetailTabs } from "../ContactDetailTabs";
import { ContactVizitkaTab } from "../ContactVizitkaTab";

export default async function ContactViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;
  const canWrite = await hasModuleAccess(userId, "contacts", "write");

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) notFound();

  const contact = await prisma.users.findFirst({
    where: { id, is_active: true },
    include: {
      roles: { select: { name: true } },
      user_secondary_departments: {
        orderBy: { id: "asc" },
        select: { departments: { select: { name: true, email: true } } },
      },
      user_shared_mails: {
        where: { shared_mails: { OR: [{ is_active: true }, { is_active: null }] } },
        include: { shared_mails: { select: { email: true, label: true, is_active: true } } },
      },
    },
  });

  if (!contact) notFound();

  const primaryDept = contact.department_id
    ? await prisma.departments.findUnique({
        where: { id: contact.department_id },
        select: { name: true, email: true },
      })
    : null;

  const fromEvidence: string[] = [];
  if (primaryDept?.name) fromEvidence.push(primaryDept.name);
  for (const s of contact.user_secondary_departments) {
    const n = s.departments?.name;
    if (n && !fromEvidence.includes(n)) fromEvidence.push(n);
  }
  const departmentDisplay =
    fromEvidence.length > 0 ? fromEvidence.join(", ") : contact.department_name || null;

  const showVizitka = await canViewContactVizitka(userId, id);
  const showPersonal = canWrite || userId === id;
  const assetBaseUrl = await getContactSignatureAssetBaseUrl();
  const signatureHtml = showVizitka
    ? buildOutlookContactSignatureHtml(
        {
          firstName: contact.first_name,
          lastName: contact.last_name,
          position: contact.position,
          email: contact.email,
          phone: contact.phone,
        },
        assetBaseUrl
      )
    : "";

  const name = `${contact.first_name} ${contact.last_name}`;

  const deptEmails: (string | null)[] = [];
  if (primaryDept?.email) deptEmails.push(primaryDept.email);
  for (const s of contact.user_secondary_departments) {
    const e = s.departments?.email;
    if (e) deptEmails.push(e);
  }
  const sharedList: { email: string; label: string }[] = [];
  for (const usm of contact.user_shared_mails) {
    const sm = usm.shared_mails;
    if (sm && sm.is_active !== false) sharedList.push({ email: sm.email, label: sm.label });
  }
  const mergedEmails = mergeUserEmails(contact.email, deptEmails, sharedList);

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{name}</h1>
          <p className="mt-1 text-gray-600">Detail kontaktu</p>
        </div>
        <div className="flex gap-2">
          {canWrite && (
            <Link
              href={`/contacts/${id}/edit`}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
            >
              <Pencil className="h-4 w-4" />
              Upravit
            </Link>
          )}
          <Link
            href="/contacts"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Zpět
          </Link>
        </div>
      </div>

      <ContactDetailTabs
        personalPhone={contact.personal_phone}
        personalEmail={contact.personal_email}
        showVizitka={showVizitka}
        vizitkaSlot={showVizitka ? <ContactVizitkaTab signatureHtml={signatureHtml} /> : undefined}
        showPersonal={showPersonal}
      >
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 md:flex-row">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-red-600 text-2xl font-bold text-white">
              {contact.first_name[0]}{contact.last_name[0]}
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{name}</h2>
                {contact.position && (
                  <p className="text-gray-600">{contact.position}</p>
                )}
                {contact.roles?.name && (
                  <span className="mt-1 inline-block rounded bg-red-100 px-2 py-0.5 text-sm text-red-700">
                    {contact.roles.name}
                  </span>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3 sm:col-span-2">
                  <Mail className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">E-mail (osobní, oddělení, společné)</p>
                    <ul className="mt-1 space-y-2">
                      {mergedEmails.map((row) => (
                        <li key={row.address}>
                          <a
                            href={`mailto:${row.address}`}
                            className={
                              row.sources.includes("společná schránka") && !row.sources.includes("osobní")
                                ? "text-gray-700 hover:underline"
                                : "text-red-600 hover:underline"
                            }
                          >
                            {row.address}
                          </a>
                          <p
                            className={
                              row.sources.includes("společná schránka") && !row.sources.includes("osobní")
                                ? "text-xs text-gray-500"
                                : "text-xs text-gray-500"
                            }
                          >
                            {row.sources.join(" · ")}
                            {row.sharedLabel && row.sources.includes("společná schránka")
                              ? ` — ${row.sharedLabel}`
                              : null}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                {contact.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Mobil</p>
                      <a href={`tel:${contact.phone}`} className="text-red-600 hover:underline">
                        {contact.phone}
                      </a>
                    </div>
                  </div>
                )}
                {contact.landline && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Pevná linka</p>
                      <span>{contact.landline}</span>
                    </div>
                  </div>
                )}
                {contact.landline2 && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Tel. linka 2</p>
                      <span>{contact.landline2}</span>
                    </div>
                  </div>
                )}
                {departmentDisplay && (
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Oddělení</p>
                      <span>{departmentDisplay}</span>
                      {fromEvidence.length > 0 &&
                        contact.department_name &&
                        contact.department_name.trim() !== "" &&
                        contact.department_name !== departmentDisplay && (
                          <p className="mt-1 text-xs text-gray-500">
                            Text v poli legacy: {contact.department_name}
                          </p>
                        )}
                    </div>
                  </div>
                )}
                {contact.qr_code && (
                  <div className="flex items-center gap-3">
                    <QrCode className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">QR kód</p>
                      <span className="font-mono">{contact.qr_code}</span>
                    </div>
                  </div>
                )}
              </div>

              {contact.notes && (
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-xs text-gray-500">Poznámky</p>
                  <p className="mt-1 text-gray-700">{contact.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </ContactDetailTabs>
    </>
  );
}
