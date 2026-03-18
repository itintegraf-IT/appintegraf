import { NextRequest, NextResponse } from "next/server";
import { getUsersWithModuleAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      requester_name,
      requester_email,
      requester_phone = "",
      department = "",
      position = "",
      equipment_type,
      description,
      priority = "st_edn_",
    } = body;

    if (!requester_name || !requester_email || !equipment_type || !description) {
      return NextResponse.json(
        { error: "Vyplňte jméno, e-mail, typ vybavení a popis" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(requester_email.trim())) {
      return NextResponse.json({ error: "Neplatný e-mail" }, { status: 400 });
    }

    const validPriority = ["n_zk_", "st_edn_", "vysok_"].includes(priority)
      ? priority
      : "st_edn_";

    const request = await prisma.equipment_requests.create({
      data: {
        requester_name: String(requester_name).trim(),
        requester_email: String(requester_email).trim(),
        requester_phone: requester_phone ? String(requester_phone).trim() : null,
        department: department ? String(department).trim() : null,
        position: position ? String(position).trim() : null,
        equipment_type: String(equipment_type).trim(),
        description: String(description).trim(),
        priority: validPriority,
        status: "nov_",
      },
    });

    const requesterName = String(requester_name).trim();
    const equipmentType = String(equipment_type).trim();
    const adminUserIds = await getUsersWithModuleAdmin("equipment");
    if (adminUserIds.length > 0) {
      await prisma.notifications.createMany({
        data: adminUserIds.map((userId) => ({
          user_id: userId,
          title: "Nový požadavek na techniku",
          message: `${requesterName} odeslal/a požadavek na ${equipmentType} (č. #${request.id}).`,
          type: "equipment_request",
          link: "/equipment",
        })),
      });
    }

    return NextResponse.json({
      success: true,
      id: request.id,
      message: `Požadavek úspěšně odeslán! Číslo požadavku: #${request.id}`,
    });
  } catch (e) {
    console.error("Equipment request POST error:", e);
    return NextResponse.json(
      { error: "Chyba systému, zkuste to později" },
      { status: 500 }
    );
  }
}
