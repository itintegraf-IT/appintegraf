import { Suspense } from "react";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import { ImlTechnologieListClient } from "./ImlTechnologieListClient";

export default async function ImlTechnologiePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    redirect("/");
  }

  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Načítání…</div>}>
      <ImlTechnologieListClient />
    </Suspense>
  );
}
