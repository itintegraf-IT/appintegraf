"use client";

import { useSearchParams } from "next/navigation";
import { preserveReturnTo, RETURN_TO_PARAM, resolveBackHref } from "@/lib/navigation/return-to";

/** Čte returnTo z URL a nabízí helpery pro zachování kontextu seznamu. */
export function useReturnTo(fallbackHref: string) {
  const searchParams = useSearchParams();
  const returnToParam = searchParams.get(RETURN_TO_PARAM);
  const backHref = resolveBackHref(returnToParam, fallbackHref);

  const withPreservedReturnTo = (href: string) => preserveReturnTo(href, returnToParam);

  return { returnToParam, backHref, withPreservedReturnTo };
}
