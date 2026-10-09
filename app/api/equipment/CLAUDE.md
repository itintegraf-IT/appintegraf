# Modul Majetek — API

Pravidla modulu: viz `lib/equipment/CLAUDE.md`. Pro routes zejména: `auth()` → 401 `{ error: "Neautorizováno" }` → oprávnění z `lib/equipment/access.ts` → 403 `{ error: "Nemáte oprávnění" }`; Prisma přes `@/lib/db`; audit přes `logEquipmentAuditSafe`.
