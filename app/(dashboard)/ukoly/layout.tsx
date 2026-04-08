import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasModuleAccess } from "@/lib/auth-utils";
import { ClipboardList } from "lucide-react";
import { UkolyTabsNav } from "./UkolyTabsNav";

export const dynamic = "force-dynamic";

export default async function UkolyLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "ukoly", "read"))) {
    redirect("/");
  }

  const canWrite = await hasModuleAccess(userId, "ukoly", "write");

  return (
    <div>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <ClipboardList className="h-7 w-7 text-red-600" />
          Úkoly
        </h1>
        <p className="mt-1 text-gray-600">Zadání a přehled úkolů</p>
      </div>
      <UkolyTabsNav canWrite={canWrite} />
      {children}
    </div>
  );
}
