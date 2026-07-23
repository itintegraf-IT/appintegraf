import {
  KanbanSquare,
  ListChecks,
  ListTodo,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/boards", label: "Boards", icon: KanbanSquare },
  { href: "/my-cards", label: "Moje karty", icon: ListTodo },
  { href: "/todo", label: "Můj To Do list", icon: ListChecks },
] as const;

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}
