# Modul Projekty — API

Pravidla modulu: viz `components/projekty/CLAUDE.md`. Pro routes zejména: Zod validator v `lib/projekty/validators/`, `withApiError`, RBAC (`canViewCard`/`canEditCard`), Prisma jen přes `lib/projekty/prisma.ts` (audit).
