import { auth } from "@/auth";
import { PhoneListClient } from "./PhoneListClient";

export default async function PhoneListPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; search?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const tab = params.tab ?? "contacts";
  const search = params.search ?? "";

  return (
    <PhoneListClient
      initialTab={tab}
      initialSearch={search}
    />
  );
}
