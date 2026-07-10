import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { redirectAdminDenied } from "@/lib/navigation-errors";
import { canManageResources } from "@/lib/resource-reservation-access";
import Link from "next/link";
import { ArrowLeft, Building2 } from "lucide-react";
import { CalendarResourcesClient } from "./CalendarResourcesClient";

export default async function AdminCalendarResourcesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);
  if (!(await canManageResources(userId))) {
    redirectAdminDenied();
  }

  return (
    <>
      <div className="mb-6">
        <Link
          href="/admin"
          className="mb-2 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-red-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Administrace
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Building2 className="h-7 w-7 text-red-600" />
          Místnosti a auta
        </h1>
        <p className="mt-1 text-gray-600">Správa zdrojů pro rezervace v kalendáři</p>
      </div>
      <CalendarResourcesClient initialType="room" />
    </>
  );
}
