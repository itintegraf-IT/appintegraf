import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { canViewContactVizitka, hasModuleAccess } from "@/lib/auth-utils";
import { buildOutlookContactSignatureHtml, getContactSignatureAssetBaseUrl } from "@/lib/contact-signature-html";
import { prisma } from "@/lib/db";
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
    include: { roles: { select: { name: true } } },
  });

  if (!contact) notFound();

  const showVizitka = await canViewContactVizitka(userId, id);
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
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">E-mail</p>
                    <a href={`mailto:${contact.email}`} className="text-red-600 hover:underline">
                      {contact.email}
                    </a>
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
                {contact.department_name && (
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Oddělení</p>
                      <span>{contact.department_name}</span>
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
