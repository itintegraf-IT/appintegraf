import { prisma } from "@/lib/db";

export async function getColorSubcategoryIds(): Promise<{
  pantoneId: number | null;
  cmykId: number | null;
}> {
  const rows = await prisma.material_subcategories.findMany({
    where: {
      category_code: "COLOR",
      parent_id: null,
      name: { in: ["PANTONE", "CMYK"] },
    },
    select: { id: true, name: true },
  });
  let pantoneId: number | null = null;
  let cmykId: number | null = null;
  for (const r of rows) {
    if (r.name === "PANTONE") pantoneId = r.id;
    if (r.name === "CMYK") cmykId = r.id;
  }
  return { pantoneId, cmykId };
}

export async function ensurePantoneSubcategoryId(): Promise<number> {
  let sub = await prisma.material_subcategories.findFirst({
    where: { category_code: "COLOR", name: "PANTONE", parent_id: null },
  });
  if (!sub) {
    sub = await prisma.material_subcategories.create({
      data: { category_code: "COLOR", name: "PANTONE", sort_order: 1 },
    });
  }
  return sub.id;
}

export async function ensureCmykSubcategoryId(): Promise<number> {
  let sub = await prisma.material_subcategories.findFirst({
    where: { category_code: "COLOR", name: "CMYK", parent_id: null },
  });
  if (!sub) {
    sub = await prisma.material_subcategories.create({
      data: { category_code: "COLOR", name: "CMYK", sort_order: 2 },
    });
  }
  return sub.id;
}
