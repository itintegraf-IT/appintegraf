import { redirect } from "next/navigation";

/** Přesměrování na společný číselník strojů. */
export default function TechnologieMachinesRedirectPage() {
  redirect("/stroje?from=technologie");
}
