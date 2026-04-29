import { Suspense } from "react";
import { PhoneListClient } from "@/components/phone-list/PhoneListClient";

export const dynamic = "force-dynamic";

export default async function PublicPhoneListPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; search?: string }>;
}) {
  const p = await searchParams;
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Načítání…</div>}>
      <div className="p-4 md:p-6">
        <PhoneListClient
          initialTab={p.tab ?? "contacts"}
          initialSearch={p.search ?? ""}
          apiBase="/api/public/phone-list"
          listPath="/public/phone-list"
        />
      </div>
    </Suspense>
  );
}
