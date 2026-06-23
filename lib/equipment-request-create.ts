import { getUsersWithModuleAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import type { equipment_requests_priority } from "@prisma/client";

type CreateEquipmentRequestInput = {
  requester_name: string;
  requester_email: string;
  requester_phone?: string | null;
  department?: string | null;
  position?: string | null;
  equipment_type: string;
  description: string;
  priority?: string;
  requester_user_id?: number | null;
};

export async function createEquipmentRequest(input: CreateEquipmentRequestInput) {
  const validPriority = ["n_zk_", "st_edn_", "vysok_"].includes(input.priority ?? "")
    ? (input.priority as equipment_requests_priority)
    : "st_edn_";

  const request = await prisma.equipment_requests.create({
    data: {
      requester_name: input.requester_name.trim(),
      requester_email: input.requester_email.trim(),
      requester_phone: input.requester_phone?.trim() || null,
      department: input.department?.trim() || null,
      position: input.position?.trim() || null,
      equipment_type: input.equipment_type.trim(),
      description: input.description.trim(),
      priority: validPriority,
      status: "nov_",
      requester_user_id: input.requester_user_id ?? null,
    },
  });

  const adminUserIds = await getUsersWithModuleAdmin("equipment");
  if (adminUserIds.length > 0) {
    await prisma.notifications.createMany({
      data: adminUserIds.map((userId) => ({
        user_id: userId,
        title: "Nový požadavek na techniku",
        message: `${input.requester_name.trim()} odeslal/a požadavek na ${input.equipment_type.trim()} (č. #${request.id}).`,
        type: "equipment_request",
        link: `/equipment?tab=requests&id=${request.id}`,
      })),
    });
  }

  return request;
}
