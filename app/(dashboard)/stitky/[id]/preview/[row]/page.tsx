import Link from "next/link";
import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { canReadStitky } from "@/lib/stitky/access";
import { generateLabels } from "@/lib/stitky/ciselna-rada";
import { isStitkyTemplateReady } from "@/lib/stitky/constants";
import { orderToInput } from "@/lib/stitky/order-utils";
import { LabelPreviewGrid } from "../../../_components/LabelPreviewGrid";
import { PreviewToolbar } from "../../../_components/PreviewToolbar";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string; row: string }> };

export default async function StitkyPreviewPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await canReadStitky(userId))) redirect("/");

  const { id, row } = await params;
  const orderId = parseInt(id, 10);
  const rowIndex = parseInt(row, 10);
  if (Number.isNaN(orderId) || Number.isNaN(rowIndex)) notFound();

  const order = await prisma.stitky_orders.findUnique({
    where: { id: orderId },
    include: { rows: { orderBy: { row_index: "asc" } }, template: true },
  });
  if (!order) notFound();

  if (!isStitkyTemplateReady(order.template.layout_status)) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <p className="font-medium">Šablona „{order.template_key}“ zatím není připravena k tisku.</p>
        <p className="mt-2">
          Layout se dokončuje — náhled a PDF budou dostupné po aktivaci šablony v administraci.
        </p>
        <Link href={`/stitky/${orderId}`} className="mt-4 inline-block text-red-700 hover:underline">
          ← Zpět na zakázku
        </Link>
      </div>
    );
  }

  const input = orderToInput(order);
  const labelRow = input.rows.find((r) => r.rowIndex === rowIndex);
  if (!labelRow?.quantity) notFound();

  const t = order.template;
  const preview = generateLabels(
    labelRow,
    {
      key: t.key,
      sheetKey: t.sheet_key,
      rowStart: t.row_start,
      rowStep: t.row_step,
      rowEnd: t.row_end,
      colStart: t.col_start,
      colStep: t.col_step,
      colEnd: t.col_end,
    },
    order.order_number,
    order.template_key
  );

  return (
    <>
      <PreviewToolbar
        orderId={orderId}
        rowIndex={rowIndex}
        backHref={`/stitky/${orderId}`}
      />
      <LabelPreviewGrid
        templateKey={order.template_key}
        componentKey={t.component_key}
        pages={preview.pages}
      />
    </>
  );
}
