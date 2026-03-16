import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getPlanovaniRole } from "@/lib/planovani-auth";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const includeInactive = searchParams.get("includeInactive") === "true";

  try {
    const options = await prisma.planovani_codebook_options.findMany({
      where: {
        ...(category ? { category } : {}),
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json(options);
  } catch (error) {
    console.error("[GET /api/planovani/codebook]", error);
    return NextResponse.json({ error: "Chyba při načítání číselníku" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getPlanovaniRole(parseInt(session.user.id, 10));
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await request.json();
    if (!body.category || !body.label) {
      return NextResponse.json({ error: "Chybí category nebo label" }, { status: 400 });
    }

    const maxItem = await prisma.planovani_codebook_options.findFirst({
      where: { category: String(body.category) },
      orderBy: { sortOrder: "desc" },
    });
    const nextSortOrder = (maxItem?.sortOrder ?? -1) + 1;

    const option = await prisma.planovani_codebook_options.create({
      data: {
        category: String(body.category),
        label: String(body.label),
        sortOrder: body.sortOrder ?? nextSortOrder,
        isActive: body.isActive ?? true,
        shortCode: body.shortCode ?? null,
        isWarning: body.isWarning ?? false,
      },
    });
    return NextResponse.json(option, { status: 201 });
  } catch (error) {
    console.error("[POST /api/planovani/codebook]", error);
    return NextResponse.json({ error: "Chyba při vytváření položky" }, { status: 500 });
  }
}
