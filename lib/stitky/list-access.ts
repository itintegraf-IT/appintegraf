import type { Prisma } from "@prisma/client";
import {
  canAdministerStitky,
  canPrintStitky,
  canWriteStitkyOrder,
} from "@/lib/stitky/access";
import type { StitkyOrderStatus } from "@/lib/stitky/constants";

export type StitkyListView = "mine" | "queue" | "all";

const QUEUE_STATUSES: StitkyOrderStatus[] = ["SUBMITTED", "SUBMITTED_MISTRI", "PRINTED"];

export async function canViewStitkyQueue(userId: number): Promise<boolean> {
  return canPrintStitky(userId);
}

export async function canViewAllStitkyOrders(userId: number): Promise<boolean> {
  return canAdministerStitky(userId);
}

export async function canAccessStitkyListView(
  userId: number,
  view: StitkyListView
): Promise<boolean> {
  if (view === "mine") return true;
  if (view === "queue") return canViewStitkyQueue(userId);
  if (view === "all") return canViewAllStitkyOrders(userId);
  return false;
}

export function buildStitkyListWhere(
  userId: number,
  view: StitkyListView,
  statusFilter?: StitkyOrderStatus | ""
): Prisma.stitky_ordersWhereInput {
  const where: Prisma.stitky_ordersWhereInput = {};

  if (view === "mine") {
    where.created_by = userId;
  } else if (view === "queue") {
    where.status = { in: QUEUE_STATUSES };
  }

  if (statusFilter) {
    where.status = statusFilter;
  }

  return where;
}

export function stitkyListOrderBy(): Prisma.stitky_ordersOrderByWithRelationInput[] {
  return [{ status: "asc" }, { updated_at: "desc" }];
}

export async function getStitkyLayoutNavFlags(userId: number): Promise<{
  canWrite: boolean;
  canQueue: boolean;
  canAll: boolean;
  canAdmin: boolean;
}> {
  const [canWrite, canQueue, canAll, canAdmin] = await Promise.all([
    canWriteStitkyOrder(userId),
    canViewStitkyQueue(userId),
    canViewAllStitkyOrders(userId),
    canAdministerStitky(userId),
  ]);
  return { canWrite, canQueue, canAll, canAdmin };
}

export const STITKY_QUEUE_STATUSES = QUEUE_STATUSES;
