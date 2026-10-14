import { NextRequest } from "next/server";
import {
  handleCatalogAttachmentFileDelete,
  handleCatalogAttachmentFileGet,
} from "@/lib/iml-catalog-attachment-api";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  return handleCatalogAttachmentFileGet("tool", req, params);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  return handleCatalogAttachmentFileDelete("tool", params);
}
