import { redirect } from "next/navigation";

/** Přesměrování na společný číselník strojů. */
export default function VykresyMachinesRedirectPage() {
  redirect("/stroje?from=vykresy");
}
