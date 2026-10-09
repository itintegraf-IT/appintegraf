# Modul Majetek — stránky

Pravidla modulu: viz `lib/equipment/CLAUDE.md`. Pro stránky zejména: čtení přes server komponenty (přímé Prisma dotazy), mutace přes `app/api/equipment/**` + `router.refresh()` (žádné Server Actions), UI z existujících komponent modulu (`app/(dashboard)/equipment/**`, `_components/`) — nikoli z `components/ui/`.
