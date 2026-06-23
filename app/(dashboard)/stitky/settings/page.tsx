import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { canAdministerStitky } from "@/lib/stitky/access";
import { StitkySettingsForm } from "./StitkySettingsForm";

export const dynamic = "force-dynamic";

export default async function StitkySettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);
  if (!(await canAdministerStitky(userId))) redirect("/stitky");

  const row = await prisma.stitky_settings.findUnique({ where: { key: "email_recipients" } });

  return (
    <>
      <StitkySettingsForm initialRecipients={row?.value ?? ""} />

      <p className="mt-6 max-w-xl text-sm text-gray-600">
        Role <strong>Tiskař</strong>, <strong>Mistr</strong> a úroveň modulu nastavujte v{" "}
        <Link href="/admin/users" className="font-medium text-red-700 hover:underline">
          administraci uživatelů
        </Link>
        . Po změně role se příjemci notifikací aktualizují automaticky.
      </p>
    </>
  );
}
