import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  buildOutlookContactSignatureHtml,
  getContactSignatureAssetBaseUrl,
} from "@/lib/contact-signature-html";
import { ContactVizitkaTab } from "@/app/(dashboard)/contacts/ContactVizitkaTab";
import { ProfileClient } from "./ProfileClient";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = parseInt(session.user.id, 10);
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: {
      first_name: true,
      last_name: true,
      position: true,
      email: true,
      phone: true,
    },
  });

  const assetBaseUrl = await getContactSignatureAssetBaseUrl();
  const signatureHtml = user
    ? buildOutlookContactSignatureHtml(
        {
          firstName: user.first_name,
          lastName: user.last_name,
          position: user.position,
          email: user.email,
          phone: user.phone,
        },
        assetBaseUrl
      )
    : "";

  return (
    <div className="space-y-8">
      <ProfileClient />

      {signatureHtml ? (
        <section>
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-900">Vizitka / e-mailový podpis</h2>
            <p className="mt-1 text-sm text-gray-600">
              Stáhněte HTML podpis a vložte ho do Outlooku Desktop.
            </p>
          </div>
          <ContactVizitkaTab signatureHtml={signatureHtml} />
        </section>
      ) : null}
    </div>
  );
}
