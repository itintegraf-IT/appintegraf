import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth-utils";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ArrowLeft } from "lucide-react";
import { AuditLogClient } from "./AuditLogClient";

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) {
    redirect("/contacts?error=Nemáte oprávnění");
  }

  const modules = await prisma.audit_log.findMany({
    select: { module: true },
    distinct: ["module"],
    orderBy: { module: "asc" },
  });

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit log</h1>
          <p className="mt-1 text-gray-600">Historie změn v systému</p>
        </div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět
        </Link>
      </div>

      <AuditLogClient modules={modules.map((m) => m.module)} />
    </>
  );
}
