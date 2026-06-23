import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  parseStitkyStatusParam,
  StitkyOrdersTable,
  StitkyStatusCards,
} from "./_components/StitkyListSections";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ status?: string }> };

export default async function StitkyListPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);

  const params = await searchParams;
  const selectedStatus = parseStitkyStatusParam(params.status);

  return (
    <>
      <StitkyStatusCards
        userId={userId}
        view="mine"
        basePath="/stitky"
        selectedStatus={selectedStatus}
      />
      <StitkyOrdersTable
        userId={userId}
        view="mine"
        basePath="/stitky"
        selectedStatus={selectedStatus}
      />
    </>
  );
}
