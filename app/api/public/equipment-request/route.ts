import { NextRequest, NextResponse } from "next/server";
import { createEquipmentRequest } from "@/lib/equipment-request-create";

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

    const request = await createEquipmentRequest({
      requester_name: String(requester_name),
      requester_email: String(requester_email),
      requester_phone: requester_phone ? String(requester_phone) : null,
      department: department ? String(department) : null,
      position: position ? String(position) : null,
      equipment_type: String(equipment_type),
      description: String(description),
      priority,
    });

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
