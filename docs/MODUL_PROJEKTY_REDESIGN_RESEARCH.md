# Modul Projekty — research pro velký build (fáze 3)

Datum: 2026-07-30 · Podklad: 4 paralelní research agenti (codebase audit, funkční benchmark PM nástrojů, vizuální/UX benchmark, design tooling pro Claude Code)

---

## 1. Zvolený směr

**„Linear škola" s barevnou čitelností Monday u statusů.** Trh PM nástrojů se dělí na dva tábory: Linear/Height/Notion (neutrální základ, vysoká hustota, barva jen jako sémantický signál, keyboard-first, rychlost) vs. Monday/ClickUp (barva jako nosič informace, nižší hustota, vizuální hravost — ClickUp je odstrašující příklad zahlcení featurami). Pro interní nástroj používaný denně ~140 lidmi platí: **rychlost a nízké tření porazí šíři funkcí**. Principy: jedna data — více pohledů; jednoduché statusy, detaily v polích; plná sytost barev výhradně pro statusy/priority/urgence.

## 2. Kritické nálezy v kódu (opravit před vším ostatním)

1. **Rozbitá sekce „Aktivita" na kartě** — `components/projekty/boards/CardActivityFeed.tsx:30` fetchuje `/api/projekty/audit?cardId=...`, ale route neexistuje; chyba je spolknuta `.catch()`. Audit log se přitom do DB píše (`projekty_audit_log`, extension `withAudit` v `lib/projekty/prisma.ts`). → Doimplementovat endpoint.
2. **27 souborů modulu používá nedefinované CSS proměnné** `--notion-canvas`, `--notion-fg`, `--notion-surface`, `--shadow-card`, `--shadow-card-hover`, `--info` (mj. `BoardView.tsx`, `CardItem.tsx`, `BoardListView.tsx`, kalendář, editor, `list-colors.ts` — varianta „Info" barvy sloupce je neviditelná). Board vizuálně „funguje" jen děděním z body. Modul má dva nekonzistentní vizuální jazyky (notion-tokeny vs. standardní shadcn tokeny). → Migrovat vše na standardní tokeny z `app/globals.css`.
3. **Mrtvý kód po PM Toolu** (0 importů): `DataTable.tsx`, `NotesTimeline.tsx`, `NoteForm.tsx`, `AttachmentList.tsx`, `AttachmentUpload.tsx`, `CollapsibleFormSection.tsx`, `DeleteConfirmDialog.tsx`, `DateTimePicker.tsx`, `lib/projekty/format-money.ts`, `date-ranges.ts`, `nav.ts`, `table-state.ts`. → Smazat.
4. Menší: zbytečný cast v `BoardCreateDialog.tsx:63` (TODO Task 10), legacy `!important` overridy na konci `globals.css` budou při redesignu překážet, žádné testy pro modul.

## 3. Gap analýza — funkce (benchmark × skutečný stav kódu)

Už máme (a research to potvrzuje jako must-have): kanban + list + kalendář, checklisty s assignee a termínem u položky (úroveň Trello Advanced checklists), komentáře, přílohy, bulk akce, URL-driven filtry, quick-add karty, ⌘K quick-capture osobního úkolu, in-app notifikace, osobní To-Do s promote na kartu, audit log (píše se, nezobrazuje se).

### Vlna A — vysoká priorita (rozhoduje o denní adopci)
| Funkce | Poznámka k implementaci |
|---|---|
| **Priority na kartě** (Urgent/High/Medium/Low à la Linear) | Nové pole v `Card`, chip v UI, řazení a filtr. Dnes se supluje labely. |
| **„Moje práce"** — sloučit `/projekty/my-cards` + `/projekty/todo` do jedné stránky se sekcemi Nově přiřazené / Dnes / Příští / Později + auto-promotion podle termínu (Asana My Tasks pattern) | Oba stavební kameny existují; chybí triage vrstva. |
| **@mentions s autocomplete** | Dnes jen regex na e-mail (`lib/projekty/mentions.ts`), bez napovídání — v praxi to nikdo nepoužije. Napojit na existující notifikace. |
| **Watchers** (auto při komentáři/zmínce, ručně přihlásit/odhlásit) | Nová vazební tabulka, napojit na `lib/projekty/notify.ts`. |
| **Šablony projektů/úkolů** s relativními termíny | Pro výrobní firmu největší úspora času (opakované procesy). |
| **Opakující se úkoly** | Nová instance vzniká dokončením předchozí, ne dopředu. Use case: uzávěrky, reporty. |
| **Uložené pohledy** (pojmenovaný filtr, volitelně sdílený) | Filtry jsou URL-driven → uložený pohled = pojmenovaná URL. Levná náhrada půlky reportingu. |
| **Fulltext vyhledávání** | Už v plánu, čeká na MySQL config s Michalem. |

### Vlna B — střední priorita
- **Zabudované automatizační recepty** per board (NE generický rule-builder): auto-archivace hotových po X dnech, notifikace před termínem + eskalace prošlých, default assignee/štítky pro nové karty, notifikace „odblokováno". ~80 % hodnoty automatizací za 10 % nákladů.
- **Přehled projektu**: % hotovo, po termínu, karty dle sloupce + ruční semafor statusu (on track / at risk / off track) s komentářem ownera. Jednoduché agregace, hodnota pro porady.
- **List view upgrade**: grouping podle assignee/štítku/termínu (ne jen podle sloupce), řazení, inline editace chipů.
- **Notifikační inbox**: archivace + snooze („připomeň zítra").
- **Přesun karty mezi boardy** (`cards/[id]/move/route.ts:42` — dnes explicitně nepodporováno) + **UI archivu** (flagy existují, obnova nemá obrazovku).
- **Odhad pracnosti** (jedno číslo v hodinách) — odemyká budoucí workload view.
- **Subtasky / závislosti / zjednodušená timeline** — až po vlně A; závislosti mají hodnotu hlavně s notifikací „odblokováno" a timeline.

### Vědomě vynechat
Plný Gantt s kritickou cestou, burndown/velocity, formulová pole, generický rule-builder, nativní time tracking s timerem (výrobní časy patří do Cicero/Pace), portfolio management, workspace UI (zůstává fixní default workspace).

## 4. Vizuální redesign — TOP změny (dopad/pracnost)

Cíl: jeden vizuální jazyk na standardních tokenech, „Linear look".

1. **Migrace z `--notion-*` na standardní tokeny** (viz bod 2.2) — nutný základ všeho.
2. **`<StatusChip>` / `<PriorityChip>`** — jednotné sémantické barvy: nezahájeno šedá, probíhá modrá/amber, hotovo zelená, blokováno červená. Dark mode vzor: `bg-{color}-500/15 text-{color}-400` (poloprůhledný sytý tón, ne tmavá paleta).
3. **Due-date badge podle urgence**: po termínu `bg-red-50 text-red-700`, do 48 h amber, jinak neutrální bez pozadí. Na kartě, v listu i kalendáři.
4. **Border místo stínu jako klidový stav karet** (`rounded-lg border`), stín jen hover (`hover:shadow-sm`) a drag (`shadow-lg rotate-2` + ghost `opacity-40 border-dashed` + akcentní drop-linka). Radius umírněně: 6–8 px karty, 4–6 px chipy.
5. **Typografická škála 4 stupňů**: UI/seznamy `text-[13px]`, text `text-sm`, sekční nadpis `text-sm font-semibold`, titulek `text-lg font-semibold tracking-tight`; čísla `tabular-nums`. Font zůstává Geist (Inter-class, netřeba měnit).
6. **Progressive disclosure**: akce řádků/karet `opacity-0 group-hover:opacity-100`, transitions 150 ms (`motion-reduce:transition-none`), nikdy 300 ms+ na hover.
7. **Skeleton loading** místo spinnerů ve tvaru reálného layoutu; spinner jen pro akce.
8. **Empty states** — komponenta `empty-state.tsx` v `components/projekty/ui/` už existuje → nasadit jednotně (monochrom ikona, 1 věta, CTA, u filtru „Zrušit filtry"), česky a lidsky.
9. **Toasty se „Zpět"** (sonner už je závislost) + optimistic updates (`useOptimistic`, React 19) min. pro přesun karty, completed, přiřazení.
10. **Detail karty jako side panel s vlastní URL** (Next.js intercepting/parallel routes, „rozbalit na stránku", „kopírovat odkaz") — dnes modal; sdílení odkazů mezi 140 lidmi je klíčové. Deep-link `?card=` už existuje na my-cards.
11. **Command palette ⌘K** (cmdk už je závislost!) — skoč na board/kartu, nový úkol, přepni pohled. Jednopísmenné zkratky v tooltipech (učí se samy).
12. **Dark mode vrstvenou elevací**: base→surface→elevated→overlay (každá vrstva o 3–6 % světlejší), text 85–92 % bílé, ne stíny.
13. Kanban sloupce: pozadí o odstín odlišné, sticky záhlaví s barevnou tečkou + counter `tabular-nums`; list view bez zebry a svislých linek, hover pozadí, sticky group headery s `backdrop-blur`.
14. Bonus: density toggle (kompakt `h-9` / komfort `h-11`).

## 5. Design tooling (Claude Code)

- **Nainstalovat: Playwright MCP** — `claude mcp add playwright npx @playwright/mcp@latest`. Jediná díra v setupu; bez screenshotů se CSS ladí naslepo.
- **Už máme a používat**: ui-ux-pro-max (vygenerovat perzistentní design system `design-system/MASTER.md` pro modul), frontend-design (exekuce — s brzdou „interní nástroj, střízlivé, žádné gradienty"), dataviz (každý graf/dashboard), context7 (Tailwind v4 syntaxe), Figma/Canva MCP (okrajové).
- **Zvážit později**: chrome-devtools-mcp (diagnostika CSS/perf), shadcn MCP (jen při strategickém sjednocení celé appky na shadcn — modul už má vlastní kopii shadcn komponent v `components/projekty/ui/`).
- **Neinstalovat**: 21st.dev Magic (placené, redundantní).
- **Design loop na každou obrazovku**: dev server běží → Playwright screenshot (1440 px + 390 px) → vizuální review proti design systému → cílená úprava → nový screenshot → iterovat; na závěr multi-agent code review.

## 6. Navržené pořadí buildu

1. **Vlna 3 — zdravý základ**: ✅ HOTOVO (1. 8. 2026, 16 commitů na feat/modul-projekty). Opravy (audit route, migrace všech 262 výskytů CSS tokenů, mrtvý kód, 4 rozbité barvy sloupců, 2 neviditelná tlačítka) + vizuální jazyk (DueDateBadge, LabelChip, checklist counter done/total, empty states, skeletony vč. route-level loading.tsx, focus-within) + lib/projekty/due-date.ts (25 testů). Multi-agent review (17 agentů): 10 minor nálezů, 8 opraveno.
2. **Vlna 4 — core UX**: side panel s URL, command palette, optimistic updates + toasty s undo, list view grouping, kanban drag feedback.
3. **Vlna 5 — funkce A**: priority, Moje práce, @mentions autocomplete, watchers, šablony, opakující se úkoly, uložené pohledy (+ fulltext až bude MySQL config).
4. **Vlna 6 — funkce B**: automatizační recepty, přehled projektu, inbox se snooze, přesun mezi boardy, UI archivu.

### Odložené nálezy z review vlny 3 (vyřešit ve vlně 4/5)
- **TZ serveru pro RSC due badge** — my-cards je čistě serverová stránka; pokud produkce běží v jiné TZ než Europe/Prague, urgence termínu se den kolem půlnoci klasifikuje špatně. Krátkodobě: ověřit s Michalem TZ produkčního procesu (nastavit `TZ=Europe/Prague`). Robustně: `Intl.DateTimeFormat` s explicitní timeZone v `lib/projekty/due-date.ts`.
- **Audit feed nedohledá historii smazaných dětí karty** — DELETE záznamy komentářů/checklistů/příloh se ve feedu Aktivita neobjeví (vazba jen přes živé řádky). v2 = denormalizovaný `cardId` sloupec v `projekty_audit_log` + backfill (vyžaduje migraci → naplánovat do vlny s DB změnami).
- **Předexistující mimo modul**: failing test `lib/backup/module-registry.test.ts` (v registru přibyl modul `makety`, test nezná) — nesouvisí s Projekty, jen upozornit vlastníka.
