import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canAccessStitkyListView } from "@/lib/stitky/list-access";
import {
  parseStitkyStatusParam,
  StitkyOrdersTable,
  StitkyStatusCards,
} from "../_components/StitkyListSections";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ status?: string }> };

export default async function StitkyFrontaPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);
  if (!(await canAccessStitkyListView(userId, "queue"))) redirect("/stitky");

  const params = await searchParams;
  const selectedStatus = parseStitkyStatusParam(params.status);

  return (
    <>
      <p className="mb-4 text-sm text-gray-600">
        Zakázky zadané do výroby — čekají na tisk nebo potvrzení zpracování.
      </p>
      <StitkyStatusCards
        userId={userId}
        view="queue"
        basePath="/stitky/fronta"
        selectedStatus={selectedStatus}
      />
      <StitkyOrdersTable
        userId={userId}
        view="queue"
        basePath="/stitky/fronta"
        selectedStatus={selectedStatus}
      />
    </>
  );
}
