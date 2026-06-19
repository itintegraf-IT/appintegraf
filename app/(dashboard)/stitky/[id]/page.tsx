import Link from "next/link";
import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  canAdministerStitky,
  canCompleteStitky,
  canDeleteStitkyOrder,
  canPrintStitky,
  canReadStitky,
  canWriteStitkyOrder,
} from "@/lib/stitky/access";
import { isStitkyTemplateReady, type StitkyOrderStatus } from "@/lib/stitky/constants";
import { stitkyStatusBadgeClass, stitkyStatusHint, stitkyStatusLabel } from "@/lib/stitky/status-badges";
import { stitkyOrderInclude } from "@/lib/stitky/order-utils";
import { StitkyOrderActions } from "../_components/StitkyOrderActions";
import { DeleteStitkyOrderButton } from "../_components/DeleteStitkyOrderButton";
import { StitkyOrderForm, type LabelRowForm } from "../_components/StitkyOrderForm";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function StitkyDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);
  if (!(await canReadStitky(userId))) redirect("/");

  const orderId = parseInt((await params).id, 10);
  if (Number.isNaN(orderId)) notFound();

  const order = await prisma.stitky_orders.findUnique({
    where: { id: orderId },
    include: stitkyOrderInclude,
  });
  if (!order) notFound();

  const templates = await prisma.stitky_templates.findMany({
    orderBy: { sort_order: "asc" },
    select: { key: true, layout_status: true },
  });

  const canWrite = await canWriteStitkyOrder(userId);
  const canPrint = await canPrintStitky(userId);
  const canComplete = await canCompleteStitky(userId);
  const canDelete = await canDeleteStitkyOrder(userId, order);
  const isAdmin = await canAdministerStitky(userId);

  const rows: LabelRowForm[] = order.rows.map((r) => ({
    rowIndex: r.row_index,
    quantity: r.quantity != null ? String(r.quantity) : "",
    packSize: r.pack_size != null ? String(r.pack_size) : "",
    text1: r.text1 ?? "",
    text2: r.text2 ?? "",
    text3: r.text3 ?? "",
    prefix: r.prefix ?? "",
    rangeFrom: r.range_from ?? "",
    rangeTo: r.range_to ?? "",
    barcodeType: r.barcode_type ?? "",
  }));

  const actionRows = order.rows.map((r) => ({
    rowIndex: r.row_index,
    hasData: r.quantity != null && r.quantity > 0,
  }));

  return (
    <>
      <Link href="/stitky" className="mb-4 inline-block text-sm text-red-700 hover:underline">
        ← Zpět na přehled
      </Link>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
          <span>
            Stav:{" "}
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${stitkyStatusBadgeClass(order.status)}`}
            >
              {stitkyStatusLabel(order.status)}
            </span>
          </span>
          {order.users_changed && (
            <span>
              Poslední změna: {order.users_changed.first_name} {order.users_changed.last_name}
            </span>
          )}
        </div>
        {canDelete && (
          <DeleteStitkyOrderButton
            orderId={order.id}
            orderNumber={order.order_number}
            isAdmin={isAdmin && order.status !== "DRAFT"}
            redirectTo={isAdmin ? "/stitky/vse" : "/stitky"}
          />
        )}
      </div>

      {stitkyStatusHint(order.status) && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          {stitkyStatusHint(order.status)}
        </div>
      )}

      <StitkyOrderActions
        orderId={order.id}
        rows={actionRows}
        canPrint={canPrint}
        canComplete={canComplete}
        layoutReady={isStitkyTemplateReady(order.template.layout_status)}
      />

      <div className="mt-6">
        <StitkyOrderForm
          templates={templates}
          orderId={order.id}
          canWrite={canWrite && order.status !== "DONE"}
          orderStatus={order.status as StitkyOrderStatus}
          initial={{
            orderNumber: order.order_number,
            templateKey: order.template_key,
            notes: order.notes ?? "",
            rows,
          }}
        />
      </div>
    </>
  );
}
