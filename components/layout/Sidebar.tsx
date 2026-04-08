"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  LayoutDashboard,
  Users,
  Laptop,
  Calendar,
  Tv,
  Phone,
  GraduationCap,
  Wrench,
  BarChart3,
  User,
  Settings,
  LogOut,
  CalendarDays,
  PanelLeftClose,
  PanelLeft,
  Package,
  Factory,
  GripVertical,
  FileText,
  ChevronDown,
  ClipboardList,
  BriefcaseBusiness,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSidebar } from "./SidebarContext";

const STORAGE_KEY_PREFIX = "sidebar-menu-order";

type SidebarProps = {
  user: { name?: string | null; id?: string };
  isAdmin: boolean;
  moduleAccess: Record<string, boolean>;
  mobileOpen?: boolean;
  onClose?: () => void;
};

type NavSubItem = { href: string; label: string };

type NavItem = {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  module: string | null;
  isActive?: (pathname: string) => boolean;
  /** Podnabídka (např. Majetek → Přiřazení majetku) */
  subItems?: NavSubItem[];
};

function navItemIsActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/") return pathname === "/";
  if (item.isActive) return item.isActive(pathname);
  return pathname.startsWith(item.href);
}

const SUBMENU_LEAVE_MS = 220;

function useSubmenuExpand(
  subItems: NavSubItem[],
  pathname: string,
  collapsed: boolean
) {
  const hasSubs = subItems.length > 0;
  const isSubActive =
    hasSubs &&
    subItems.some((s) => pathname === s.href || pathname.startsWith(`${s.href}/`));
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    };
  }, []);

  const clearLeave = useCallback(() => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  }, []);

  const onEnter = useCallback(() => {
    if (!hasSubs || collapsed) return;
    clearLeave();
    setHover(true);
  }, [hasSubs, collapsed, clearLeave]);

  const onLeave = useCallback(() => {
    if (!hasSubs || collapsed) return;
    clearLeave();
    leaveTimer.current = setTimeout(() => setHover(false), SUBMENU_LEAVE_MS);
  }, [hasSubs, collapsed, clearLeave]);

  const togglePinned = useCallback(() => setPinned((p) => !p), []);

  const showSub = hasSubs && !collapsed && (isSubActive || hover || pinned);

  return { showSub, onEnter, onLeave, togglePinned, hasSubs };
}

function NavSubLinks({
  subItems,
  pathname,
  onClick,
  collapsed,
}: {
  subItems: NavSubItem[];
  pathname: string;
  onClick?: () => void;
  collapsed: boolean;
}) {
  if (collapsed || !subItems.length) return null;
  return (
    <ul className="ml-2 mt-1 space-y-0.5 border-l border-[var(--sidebar-border)] pl-2">
      {subItems.map((sub) => {
        const subActive = pathname === sub.href || pathname.startsWith(`${sub.href}/`);
        return (
          <li key={sub.href}>
            <Link
              href={sub.href}
              onClick={onClick}
              className={`block rounded py-1.5 pl-2 pr-1 text-xs transition-colors ${
                subActive
                  ? "font-medium text-[var(--sidebar-accent-foreground)]"
                  : "text-[var(--sidebar-foreground)]/90 hover:bg-[var(--sidebar-accent)]/60"
              }`}
              style={
                subActive
                  ? { background: "var(--sidebar-accent)" }
                  : undefined
              }
            >
              {sub.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function SortableNavItem({
  item,
  isActive,
  onClick,
  collapsed,
  pathname,
}: {
  item: NavItem;
  isActive: boolean;
  onClick?: () => void;
  collapsed: boolean;
  pathname: string;
}) {
  const Icon = item.icon;
  const subs = item.subItems ?? [];
  const { showSub, onEnter, onLeave, togglePinned, hasSubs } = useSubmenuExpand(
    subs,
    pathname,
    collapsed
  );
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.href });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const mainRow = (
    <div
      style={{
        borderLeftColor: isActive ? "var(--sidebar-primary)" : "transparent",
        background: isActive ? "var(--sidebar-accent)" : "transparent",
      }}
      className={`flex items-center gap-1 rounded-lg border-l-[3px] text-sm transition-colors px-2 py-2 ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="touch-none cursor-grab active:cursor-grabbing rounded p-0.5 hover:bg-[var(--sidebar-accent)] shrink-0"
        style={{ color: "var(--sidebar-foreground)" }}
        aria-label="Přesunout položku"
        onClick={(e) => e.preventDefault()}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Link
        href={item.href}
        onClick={onClick}
        className={`flex flex-1 items-center gap-3 min-w-0 py-0.5 rounded-r-lg hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)] ${
          collapsed ? "justify-center" : ""
        }`}
        style={{
          color: isActive ? "var(--sidebar-accent-foreground)" : "var(--sidebar-foreground)",
        }}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
      {hasSubs && !collapsed && (
        <button
          type="button"
          aria-expanded={showSub}
          aria-label={showSub ? "Sbalit podnabídku" : "Rozbalit podnabídku"}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            togglePinned();
          }}
          className="shrink-0 rounded p-0.5 hover:bg-[var(--sidebar-accent)]/80"
          style={{ color: "var(--sidebar-foreground)" }}
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ${showSub ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
      )}
    </div>
  );

  const subPanel =
    hasSubs && !collapsed ? (
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          showSub ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
        aria-hidden={!showSub}
      >
        <div className={`min-h-0 overflow-hidden ${!showSub ? "pointer-events-none" : ""}`}>
          <NavSubLinks
            subItems={subs}
            pathname={pathname}
            onClick={onClick}
            collapsed={false}
          />
        </div>
      </div>
    ) : null;

  const sortableBlock = (
    <div
      ref={setNodeRef}
      style={style}
      onMouseEnter={hasSubs && !collapsed ? onEnter : undefined}
      onMouseLeave={hasSubs && !collapsed ? onLeave : undefined}
    >
      {mainRow}
      {subPanel}
    </div>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <div ref={setNodeRef} style={style}>
            {mainRow}
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return sortableBlock;
}

function NavLink({
  href,
  icon: Icon,
  label,
  isActive,
  onClick,
  collapsed,
  subItems,
  pathname,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isActive: boolean;
  onClick?: () => void;
  collapsed: boolean;
  subItems?: NavSubItem[];
  pathname: string;
}) {
  const subs = subItems ?? [];
  const { showSub, onEnter, onLeave, togglePinned, hasSubs } = useSubmenuExpand(
    subs,
    pathname,
    collapsed
  );

  const rowStyle = {
    background: isActive ? "var(--sidebar-accent)" : "transparent",
    color: isActive ? "var(--sidebar-accent-foreground)" : "var(--sidebar-foreground)",
    borderLeftColor: isActive ? "var(--sidebar-primary)" : "transparent",
  } as const;

  const linkOnly = (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-lg border-l-[3px] px-3 py-2 text-sm transition-colors hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)] ${
        collapsed ? "justify-center px-2" : ""
      }`}
      style={rowStyle}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span>{label}</span>}
    </Link>
  );

  const rowWithSubs = (
    <div
      className="flex items-center gap-1 rounded-lg border-l-[3px] px-2 py-2 text-sm transition-colors hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
      style={rowStyle}
    >
      <Link
        href={href}
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-r-lg py-0.5 hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
        style={{ color: rowStyle.color }}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span className="truncate">{label}</span>
      </Link>
      <button
        type="button"
        aria-expanded={showSub}
        aria-label={showSub ? "Sbalit podnabídku" : "Rozbalit podnabídku"}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          togglePinned();
        }}
        className="shrink-0 rounded p-0.5 hover:bg-[var(--sidebar-accent)]/80"
        style={{ color: "var(--sidebar-foreground)" }}
      >
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-200 ${showSub ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
    </div>
  );

  const subPanel =
    hasSubs && !collapsed ? (
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          showSub ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
        aria-hidden={!showSub}
      >
        <div className={`min-h-0 overflow-hidden ${!showSub ? "pointer-events-none" : ""}`}>
          <NavSubLinks subItems={subs} pathname={pathname} onClick={onClick} collapsed={false} />
        </div>
      </div>
    ) : null;

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{linkOnly}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  if (hasSubs) {
    return (
      <div onMouseEnter={onEnter} onMouseLeave={onLeave}>
        {rowWithSubs}
        {subPanel}
      </div>
    );
  }

  return linkOnly;
}

const navItems: NavItem[] = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard", module: null },
  { href: "/contacts", icon: Users, label: "Kontakty", module: "contacts" },
  {
    href: "/equipment",
    icon: Laptop,
    label: "Majetek",
    module: "equipment",
    subItems: [{ href: "/equipment/prirazeni", label: "Přiřazení majetku" }],
    isActive: (p) => p.startsWith("/equipment"),
  },
  { href: "/calendar", icon: Calendar, label: "Kalendář", module: "calendar" },
  { href: "/ukoly", icon: ClipboardList, label: "Úkoly", module: "ukoly" },
  { href: "/personalistika", icon: BriefcaseBusiness, label: "Personalistika", module: "personalistika" },
  { href: "/contracts", icon: FileText, label: "Evidence smluv", module: "contracts" },
  { href: "/planovani", icon: CalendarDays, label: "Plánování výroby", module: "planovani" },
  { href: "/vyroba", icon: Factory, label: "Výroba", module: "vyroba" },
  { href: "/iml", icon: Package, label: "IML", module: "iml" },
  { href: "/kiosk", icon: Tv, label: "Kiosk Monitory", module: "kiosk" },
  { href: "/phone-list", icon: Phone, label: "Telefonní seznam", module: null },
  { href: "/training", icon: GraduationCap, label: "IT Školení", module: "training" },
];

function getStoredOrder(userId: string | undefined): string[] {
  if (typeof window === "undefined" || !userId) return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}-${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveOrder(userId: string | undefined, order: string[]) {
  if (typeof window === "undefined" || !userId) return;
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}-${userId}`, JSON.stringify(order));
  } catch {
    // ignore
  }
}

export function Sidebar({ user, isAdmin, moduleAccess, mobileOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { state, collapsed, pinned, toggleCollapsed } = useSidebar();
  const isCollapsed = collapsed && !mobileOpen;
  const isPinned = pinned && !mobileOpen;
  const userId = user?.id;

  const visibleItems = navItems.filter((item) => {
    if (item.module && !moduleAccess[item.module]) return false;
    return true;
  });
  const visibleHrefs = visibleItems.map((i) => i.href).join(",");

  const [orderedItems, setOrderedItems] = useState<NavItem[]>(() => visibleItems);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const items = navItems.filter((item) => {
      if (item.module && !moduleAccess[item.module]) return false;
      return true;
    });
    const stored = getStoredOrder(userId);
    const orderMap = new Map(stored.map((href, i) => [href, i]));
    const next = [...items].sort((a, b) => {
      const ai = orderMap.has(a.href) ? orderMap.get(a.href)! : 999;
      const bi = orderMap.has(b.href) ? orderMap.get(b.href)! : 999;
      return ai - bi;
    });
    setOrderedItems(next);
  }, [userId, visibleHrefs]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      setOrderedItems((prev) => {
        const ids = prev.map((i) => i.href);
        const oldIndex = ids.indexOf(active.id as string);
        const newIndex = ids.indexOf(over.id as string);
        if (oldIndex === -1 || newIndex === -1) return prev;
        const next = arrayMove(prev, oldIndex, newIndex);
        saveOrder(userId, next.map((i) => i.href));
        return next;
      });
    },
    [userId]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={`fixed left-0 top-14 z-50 h-[calc(100vh-3.5rem)] flex-col border-r transition-all duration-200 ${
          isPinned ? "hidden" : mobileOpen ? "flex translate-x-0 lg:flex" : "hidden -translate-x-full lg:translate-x-0 lg:flex"
        } ${!isPinned && (isCollapsed ? "w-16" : "w-56")}`}
        style={{
          background: "var(--sidebar)",
          borderColor: "var(--sidebar-border)",
          boxShadow: "var(--sidebar-shadow)",
        }}
      >
      <div className="flex flex-col h-full">
      <div
        className={`flex items-center border-b shrink-0 ${isCollapsed ? "justify-center px-2 py-2" : "justify-between px-3 py-2"}`}
        style={{ borderColor: "var(--sidebar-border)" }}
      >
        {!isCollapsed && (
          <span className="text-sm font-medium" style={{ color: "var(--sidebar-foreground)" }}>
            Menu
          </span>
        )}
        <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggleCollapsed}
                className="rounded-lg p-2 hover:bg-[var(--sidebar-accent)] transition-colors"
                style={{ color: "var(--sidebar-foreground)" }}
                aria-label={state === "expanded" ? "Sbalit na ikony" : state === "rail" ? "Sbalit úplně" : "Rozbalit menu"}
              >
                {state === "expanded" ? (
                  <PanelLeftClose className="h-5 w-5" />
                ) : state === "rail" ? (
                  <PanelLeftClose className="h-5 w-5" />
                ) : (
                  <PanelLeft className="h-5 w-5" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {state === "expanded" ? "Sbalit na ikony" : state === "rail" ? "Sbalit úplně" : "Rozbalit menu"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <nav className="flex-1 overflow-y-auto py-4">
        <TooltipProvider>
        <ul className="space-y-0.5 px-2">
          {mounted ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={orderedItems.map((i) => i.href)}
                strategy={verticalListSortingStrategy}
              >
                {orderedItems.map((item) => {
                  const isActive = navItemIsActive(item, pathname);
                  return (
                    <li key={item.href}>
                      <SortableNavItem
                        item={item}
                        isActive={!!isActive}
                        onClick={onClose}
                        collapsed={isCollapsed}
                        pathname={pathname}
                      />
                    </li>
                  );
                })}
              </SortableContext>
            </DndContext>
          ) : (
            orderedItems.map((item) => {
              const isActive = navItemIsActive(item, pathname);
              return (
                <li key={item.href}>
                  <NavLink
                    href={item.href}
                    icon={item.icon}
                    label={item.label}
                    isActive={!!isActive}
                    onClick={onClose}
                    collapsed={isCollapsed}
                    subItems={item.subItems}
                    pathname={pathname}
                  />
                </li>
              );
            })
          )}

          {isAdmin && (
            <>
              <li className="my-2 border-t" style={{ borderColor: "var(--sidebar-border)" }} />
              <li>
                <NavLink
                  href="/admin"
                  icon={Wrench}
                  label="Administrace"
                  isActive={pathname.startsWith("/admin")}
                  onClick={onClose}
                  collapsed={isCollapsed}
                  pathname={pathname}
                />
              </li>
              <li>
                <NavLink
                  href="/admin/reports"
                  icon={BarChart3}
                  label="Reporty"
                  isActive={pathname === "/admin/reports"}
                  onClick={onClose}
                  collapsed={isCollapsed}
                  pathname={pathname}
                />
              </li>
            </>
          )}

          <li className="my-2 border-t" style={{ borderColor: "var(--sidebar-border)" }} />
          <li>
            <NavLink
              href="/profile"
              icon={User}
              label="Profil"
              isActive={false}
              onClick={onClose}
              collapsed={isCollapsed}
              pathname={pathname}
            />
          </li>
          <li>
            <NavLink
              href="/settings"
              icon={Settings}
              label="Nastavení"
              isActive={false}
              onClick={onClose}
              collapsed={isCollapsed}
              pathname={pathname}
            />
          </li>
        </ul>
        </TooltipProvider>
      </nav>

      <div
        className={`flex items-center border-t p-3 ${isCollapsed ? "flex-col gap-2 justify-center px-2" : "gap-3"}`}
        style={{ borderColor: "var(--sidebar-border)" }}
      >
        <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-medium cursor-default"
                style={{ background: "var(--sidebar-primary)", color: "var(--sidebar-primary-foreground)" }}
              >
                {initials}
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {user.name}
            </TooltipContent>
          </Tooltip>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium" style={{ color: "var(--sidebar-foreground)" }}>
                {user.name}
              </p>
              <p className="truncate text-xs" style={{ color: "var(--muted-foreground)" }}>
                Odhlásit
              </p>
            </div>
          )}
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Link
                href="/api/auth/signout"
                onClick={onClose}
                className={`rounded-lg p-2 hover:bg-[var(--sidebar-accent)] ${isCollapsed ? "block" : ""}`}
                style={{ color: "var(--sidebar-foreground)" }}
                title="Odhlásit se"
              >
                <LogOut className="h-5 w-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Odhlásit se
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      </div>
    </aside>
    </>
  );
}
