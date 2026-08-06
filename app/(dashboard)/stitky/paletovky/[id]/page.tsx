import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { canReadStitky, canWriteStitkyOrder } from "@/lib/stitky/access";
import {
  parsePaletovkaDocumentData,
  type PaletovkaLayoutVariant,
} from "@/lib/stitky/paletovky/types";
import { PaletovkaDetailClient } from "../_components/PaletovkaDetailClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function PaletovkaDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);
  if (!(await canReadStitky(userId))) redirect("/");

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) notFound();

  const row = await prisma.stitky_paletovky.findUnique({
    where: { id },
    include: { template: true },
  });
  if (!row) notFound();

  const data = parsePaletovkaDocumentData(row.data_json);
  if (!data) notFound();

  const canWrite = await canWriteStitkyOrder(userId);

  return (
    <PaletovkaDetailClient
      paletovkaId={row.id}
      title={row.title}
      status={row.status}
      layoutVariant={row.template.layout_variant as PaletovkaLayoutVariant}
      blocksPerPage={row.template.blocks_per_page}
      initialData={data}
      canWrite={canWrite}
    />
  );
}
