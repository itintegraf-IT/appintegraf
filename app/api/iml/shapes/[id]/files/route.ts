import { NextRequest } from "next/server";
import {
  handleCatalogAttachmentsGet,
  handleCatalogAttachmentsPost,
} from "@/lib/iml-catalog-attachment-api";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleCatalogAttachmentsGet("shape", params);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleCatalogAttachmentsPost("shape", req, params);
}
