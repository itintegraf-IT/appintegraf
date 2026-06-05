import { revalidatePath } from "next/cache";

/** Obnoví SSR přehledy po změně fronty / priority (kalendář, seznam, fronta). */
export function revalidateMaketyViews() {
  revalidatePath("/makety");
  revalidatePath("/makety/zadani");
  revalidatePath("/makety/fronta");
  revalidatePath("/makety/kalendar");
  revalidatePath("/makety/kalendar-grafika");
  revalidatePath("/makety/archive");
}
