"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useReturnTo } from "@/lib/navigation/use-return-to";

type BackLinkProps = {
  fallbackHref: string;
  className?: string;
  children?: React.ReactNode;
  showIcon?: boolean;
  /** Pokud true, preferuje router.back() když není returnTo v URL. */
  preferHistoryBack?: boolean;
};

const defaultClassName =
  "inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50";

export function BackLink({
  fallbackHref,
  className = defaultClassName,
  children = "Zpět",
  showIcon = true,
  preferHistoryBack = true,
}: BackLinkProps) {
  const router = useRouter();
  const { returnToParam, backHref } = useReturnTo(fallbackHref);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (returnToParam) return;
    if (preferHistoryBack && typeof window !== "undefined" && window.history.length > 1) {
      e.preventDefault();
      router.back();
    }
  };

  return (
    <Link href={backHref} onClick={handleClick} className={className}>
      {showIcon && <ArrowLeft className="h-4 w-4" />}
      {children}
    </Link>
  );
}
