import Link from "next/link";
import { Phone, Home, LogIn } from "lucide-react";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-600 text-white">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900">INTEGRAF</h1>
              <p className="text-sm text-gray-500">Modulární intranetová aplikace</p>
            </div>
          </div>
          <nav className="flex gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              <Home className="h-4 w-4" />
              Hlavní stránka
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              <LogIn className="h-4 w-4" />
              Přihlášení
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
