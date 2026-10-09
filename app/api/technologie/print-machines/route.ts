import { NextRequest } from "next/server";
import { GET as sharedGet, POST as sharedPost } from "@/app/api/shared-machines/route";

/** Alias → /api/shared-machines (zpětná kompatibilita). */
export async function GET(req: NextRequest) {
  return sharedGet(req);
}

export async function POST(req: NextRequest) {
  return sharedPost(req);
}
