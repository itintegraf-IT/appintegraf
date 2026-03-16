import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  try {
    const contentType = req.headers.get("content-type") ?? "";
    let name: string;
    let description = "";
    let transition_effect = "fade";
    let transition_time = 5;
    let display_duration = 10;
    let files: File[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      name = String(formData.get("name") ?? "").trim();
      description = String(formData.get("description") ?? "").trim();
      transition_effect = String(formData.get("transition_effect") ?? "fade").trim() || "fade";
      transition_time = parseInt(String(formData.get("transition_time") ?? "5"), 10) || 5;
      display_duration = parseInt(String(formData.get("display_duration") ?? "10"), 10) || 10;
      files = (formData.getAll("files") as File[]).filter((f) => f instanceof File && f.size > 0);
    } else {
      const body = await req.json();
      name = String(body.name ?? "").trim();
      description = String(body.description ?? "").trim();
      transition_effect = String(body.transition_effect ?? "fade").trim() || "fade";
      transition_time = parseInt(String(body.transition_time ?? "5"), 10) || 5;
      display_duration = parseInt(String(body.display_duration ?? "10"), 10) || 10;
    }

    if (!name) {
      return NextResponse.json({ error: "Vyplňte název prezentace" }, { status: 400 });
    }

    const userId = parseInt(session.user.id, 10);
    const presentation = await prisma.presentations.create({
      data: {
        name,
        description: description || null,
        transition_effect,
        transition_time,
        display_duration,
        is_active: true,
        created_by: userId,
      },
    });

    if (files.length > 0) {
      const uploadDir = path.join(process.cwd(), "public", "uploads", "kiosk");
      await mkdir(uploadDir, { recursive: true });

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const mime = file.type;
        if (!ALLOWED_TYPES.includes(mime)) continue;
        if (file.size > MAX_SIZE) continue;

        const ext = path.extname(file.name) || (mime === "application/pdf" ? ".pdf" : ".jpg");
        const newFilename = `${Date.now()}_${i}_${Math.random().toString(36).slice(2)}${ext}`;
        const filePath = path.join(uploadDir, newFilename);

        const bytes = await file.arrayBuffer();
        await writeFile(filePath, Buffer.from(bytes));

        const fileType = mime === "application/pdf" ? "pdf" : "image";
        await prisma.slides.create({
          data: {
            presentation_id: presentation.id,
            filename: file.name,
            file_path: `/uploads/kiosk/${newFilename}`,
            file_type: fileType,
            duration: display_duration,
            transition_effect,
            visible: true,
            sort_order: i,
          },
        });
      }
    }

    return NextResponse.json({ success: true, id: presentation.id });
  } catch (e) {
    console.error("Kiosk POST error:", e);
    return NextResponse.json({ error: "Chyba při vytváření prezentace" }, { status: 500 });
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const presentations = await prisma.presentations.findMany({
    where: { is_active: true },
    orderBy: { name: "asc" },
    take: 50,
  });

  return NextResponse.json({ presentations });
}
