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

type HeaderProps = {
  user: {
    name?: string | null;
    email?: string | null;
    id?: string;
  };
  isAdmin: boolean;
};

export function Header({ user, isAdmin }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center border-b border-gray-200 bg-white px-4 shadow-sm">
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden rounded-lg p-2 text-gray-600 hover:bg-gray-100"
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/" className="flex items-center gap-2 font-bold text-red-600">
            <LayoutDashboard className="h-6 w-6" />
            <span className="hidden sm:inline">INTEGRAF</span>
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden md:flex items-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5">
            <Search className="mr-2 h-4 w-4 text-gray-400" />
            <input
              type="search"
              placeholder="Vyhledat..."
              className="w-40 bg-transparent text-sm outline-none placeholder:text-gray-500"
            />
          </div>

          <button
            type="button"
            className="relative rounded-lg p-2 text-gray-600 hover:bg-gray-100"
            aria-label="Notifikace"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
              0
            </span>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-gray-100"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-sm font-medium text-white">
                {initials}
              </div>
              <span className="hidden text-left text-sm sm:block">
                <span className="block font-medium text-gray-900">{user.name}</span>
                <span className="block text-xs text-gray-500">{user.email}</span>
              </span>
            </button>

            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                  aria-hidden
                />
                <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  <div className="border-b border-gray-100 px-4 py-3">
                    <p className="font-medium text-gray-900">{user.name}</p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>
                  <Link
                    href="/profile"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => setMenuOpen(false)}
                  >
                    <User className="h-4 w-4" />
                    Profil
                  </Link>
                  <Link
                    href="/settings"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Settings className="h-4 w-4" />
                    Nastavení
                  </Link>
                  {isAdmin && (
                    <Link
                      href="/admin"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      onClick={() => setMenuOpen(false)}
                    >
                      <Wrench className="h-4 w-4" />
                      Administrace
                    </Link>
                  )}
                  <div className="my-1 border-t border-gray-100" />
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
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
