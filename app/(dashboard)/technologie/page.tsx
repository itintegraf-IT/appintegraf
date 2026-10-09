import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasModuleAccess } from "@/lib/auth-utils";
import { canReadTechnologie } from "@/lib/technologie/access";
import { TechnologieListClient } from "./TechnologieListClient";

export default async function TechnologiePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await canReadTechnologie(userId))) redirect("/");

  const canWrite = await hasModuleAccess(userId, "technologie", "write");

  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Načítání…</div>}>
      <TechnologieListClient canWrite={canWrite} />
    </Suspense>
  );
}
