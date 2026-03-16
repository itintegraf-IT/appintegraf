import { Suspense } from "react";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { ContactsClient } from "./ContactsClient";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; department?: string; sort?: string; dir?: string; page?: string; per_page?: string; tab?: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;
  const canWrite = await hasModuleAccess(userId, "contacts", "write");

  const params = await searchParams;
  const search = params.search ?? "";
  const department = params.department ?? "";
  const sort = params.sort ?? "last_name";
  const dir = params.dir ?? "asc";
  const page = parseInt(params.page ?? "1", 10) || 1;
  const perPage = params.per_page ?? "20";
  const tab = params.tab ?? "all";

  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Načítání…</div>}>
    <ContactsClient
      initialSearch={search}
      initialDepartment={department}
      initialSort={sort}
      initialDir={dir}
      initialPage={page}
      initialPerPage={perPage}
      initialTab={tab}
      canWrite={canWrite}
    />
    </Suspense>
  );
}
