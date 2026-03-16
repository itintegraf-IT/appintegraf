"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Search,
  Bell,
  User,
  Settings,
  Wrench,
  LogOut,
  Menu,
} from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "./ThemeToggle";

type HeaderProps = {
  user: {
    name?: string | null;
    email?: string | null;
    id?: string;
  };
  isAdmin: boolean;
  onMenuClick?: () => void;
};

export function Header({ user, isAdmin, onMenuClick }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <header
      className="sticky top-0 z-40 flex h-14 items-center border-b px-4"
      style={{
        background: "color-mix(in oklab, var(--surface) 88%, transparent)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderColor: "color-mix(in oklab, var(--border) 70%, transparent)",
      }}
    >
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onMenuClick}
            className="lg:hidden rounded-lg p-2 hover:bg-[var(--accent)]"
            style={{ color: "var(--foreground)" }}
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link
            href="/"
            className="flex items-center gap-2 font-bold"
            style={{ color: "var(--primary)" }}
          >
            <LayoutDashboard className="h-6 w-6" />
            <span className="hidden sm:inline">INTEGRAF</span>
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div
            className="hidden md:flex items-center rounded-lg border px-3 py-1.5"
            style={{
              background: "var(--surface-2)",
              borderColor: "var(--border)",
            }}
          >
            <Search className="mr-2 h-4 w-4" style={{ color: "var(--muted-foreground)" }} />
            <input
              type="search"
              placeholder="Vyhledat..."
              className="w-40 bg-transparent text-sm outline-none"
              style={{
                color: "var(--foreground)",
                ["--tw-placeholder-opacity" as string]: "0.6",
              }}
            />
          </div>

          <ThemeToggle />

          <button
            type="button"
            className="relative rounded-lg p-2 hover:bg-[var(--accent)]"
            style={{ color: "var(--foreground)" }}
            aria-label="Notifikace"
          >
            <Bell className="h-5 w-5" />
            <span
              className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-medium"
              style={{ background: "var(--destructive)", color: "white" }}
            >
              0
            </span>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-[var(--accent)]"
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium"
                style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                {initials}
              </div>
              <span className="hidden text-left text-sm sm:block">
                <span className="block font-medium" style={{ color: "var(--foreground)" }}>
                  {user.name}
                </span>
                <span className="block text-xs" style={{ color: "var(--muted-foreground)" }}>
                  {user.email}
                </span>
              </span>
            </button>

            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                  aria-hidden
                />
                <div
                  className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border py-1 shadow-lg"
                  style={{
                    background: "var(--card)",
                    borderColor: "var(--border)",
                  }}
                >
                  <div
                    className="border-b px-4 py-3"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <p className="font-medium" style={{ color: "var(--foreground)" }}>
                      {user.name}
                    </p>
                    <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                      {user.email}
                    </p>
                  </div>
                  <Link
                    href="/profile"
                    className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-[var(--accent)]"
                    style={{ color: "var(--foreground)" }}
                    onClick={() => setMenuOpen(false)}
                  >
                    <User className="h-4 w-4" />
                    Profil
                  </Link>
                  <Link
                    href="/settings"
                    className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-[var(--accent)]"
                    style={{ color: "var(--foreground)" }}
                    onClick={() => setMenuOpen(false)}
                  >
                    <Settings className="h-4 w-4" />
                    Nastavení
                  </Link>
                  {isAdmin && (
                    <Link
                      href="/admin"
                      className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-[var(--accent)]"
                      style={{ color: "var(--foreground)" }}
                      onClick={() => setMenuOpen(false)}
                    >
                      <Wrench className="h-4 w-4" />
                      Administrace
                    </Link>
                  )}
                  <div className="my-1 border-t" style={{ borderColor: "var(--border)" }} />
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-[var(--destructive)]/10"
                    style={{ color: "var(--destructive)" }}
                  >
                    <LogOut className="h-4 w-4" />
                    Odhlásit se
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
