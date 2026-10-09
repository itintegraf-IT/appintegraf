import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canWriteSharedMachines } from "@/lib/shared-machines/access";
import { SharedMachinesClient } from "./SharedMachinesClient";

export default async function SharedMachinesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await canWriteSharedMachines(userId))) redirect("/");

  const from = (await searchParams).from;
  const backHref =
    from === "technologie"
      ? "/technologie"
      : from === "vykresy"
        ? "/vykresy"
        : "/";

  return <SharedMachinesClient backHref={backHref} />;
}
