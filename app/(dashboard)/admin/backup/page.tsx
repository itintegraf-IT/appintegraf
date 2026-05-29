import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { redirectAdminDenied } from "@/lib/navigation-errors";
import { isAdmin } from "@/lib/auth-utils";
import Link from "next/link";
import { Archive, ChevronLeft } from "lucide-react";
import { BackupRestorePanel } from "@/components/admin/BackupRestorePanel";

export default async function AdminBackupPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) {
    redirectAdminDenied();
  }

  return (
    <>
      <div className="mb-6">
        <Link
          href="/admin"
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4" />
          Administrace
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Archive className="h-7 w-7 text-red-600" />
          Záloha a obnova dat
        </h1>
        <p className="mt-1 text-gray-600">
          Export a obnova modulů včetně souborů a IML PDF/obrázků. Pouze pro globální administrátory.
        </p>
      </div>
      <BackupRestorePanel />
    </>
  );
}
