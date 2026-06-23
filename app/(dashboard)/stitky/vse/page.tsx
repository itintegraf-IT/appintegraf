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

export default async function StitkyVsePage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);
  if (!(await canAccessStitkyListView(userId, "all"))) redirect("/stitky");

  const params = await searchParams;
  const selectedStatus = parseStitkyStatusParam(params.status);

  return (
    <>
      <StitkyStatusCards
        userId={userId}
        view="all"
        basePath="/stitky/vse"
        selectedStatus={selectedStatus}
      />
      <StitkyOrdersTable
        userId={userId}
        view="all"
        basePath="/stitky/vse"
        selectedStatus={selectedStatus}
        showCreator
      />
    </>
  );
}
