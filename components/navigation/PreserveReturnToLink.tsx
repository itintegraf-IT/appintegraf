"use client";

import Link from "next/link";
import { useReturnTo } from "@/lib/navigation/use-return-to";

type Props = {
  href: string;
  className?: string;
  children: React.ReactNode;
  title?: string;
};

/** Odkaz zachová returnTo z aktuální URL (kontext filtrovaného seznamu). */
export function PreserveReturnToLink({ href, className, children, title }: Props) {
  const { withPreservedReturnTo } = useReturnTo(href);
  return (
    <Link href={withPreservedReturnTo(href)} className={className} title={title}>
      {children}
    </Link>
  );
}
