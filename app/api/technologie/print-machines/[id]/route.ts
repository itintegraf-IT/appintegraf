import { NextRequest } from "next/server";
import {
  PUT as sharedPut,
  DELETE as sharedDelete,
} from "@/app/api/shared-machines/[id]/route";

/** Alias → /api/shared-machines/[id]. */
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  return sharedPut(req, ctx);
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  return sharedDelete(req, ctx);
}
