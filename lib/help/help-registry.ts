import {
  LayoutDashboard,
  Calendar,
  Users,
  Laptop,
  ClipboardList,
  BriefcaseBusiness,
  FileText,
  CalendarDays,
  Factory,
  Package,
  Layers,
  Tv,
  Phone,
  GraduationCap,
  KanbanSquare,
  Wrench,
  User,
  Settings,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

export type HelpDocLink = {
  label: string;
  href: string;
};

export type HelpEntry = {
  /** Stabilní klíč (název modulu) */
  key: string;
  /** Modul z `moduleAccess` (viz lib/auth-utils). Pokud je null, není vázán na oprávnění. */
  module: string | null;
  /** Vyžadována admin role */
  requiresAdmin?: boolean;
  /** Ikona pro hlavičku panelu */
  icon: LucideIcon;
  /** Titulek v hlavičce panelu */
  title: string;
  /** Krátký podtitul / „Cesta" */
  path?: string;
  /** 1–2 věty co modul dělá */
  intro: string;
  /** „Co modul umí" (bullet body) */
  features: string[];
  /** „Rychlý návod" (číslované kroky) */
  quickSteps: string[];
  /** Praktické tipy / triky */
  tips?: string[];
  /** Klávesové zkratky (popis akce → zkratka) */
  shortcuts?: { keys: string; action: string }[];
  /** Odkazy na detailní manuály (uloženo v `docs/`) */
  docs?: HelpDocLink[];
};

/**
 * Centrální nápověda pro INTEGRAF.
 * Klíč „dashboard" = celá aplikace (zobrazí se na úvodní stránce / pro neznámé cesty).
 * Ostatní klíče odpovídají prefixům cest – mapování viz `resolve-help.ts`.
 */
export const HELP_REGISTRY: Record<string, HelpEntry> = {
  dashboard: {
    key: "dashboard",
    module: null,
    icon: LayoutDashboard,
    title: "Nápověda k aplikaci INTEGRAF",
    path: "/",
    intro:
      "INTEGRAF je interní portál sdružující evidenci kontaktů, majetku, kalendář, úkoly, smlouvy, výrobu, IML, katalog materiálů a další moduly. Tato nápověda vás rychle provede orientací v aplikaci.",
    features: [
      "Levé menu (sidebar) obsahuje všechny moduly, ke kterým máte přístup.",
      "Pořadí položek menu si můžete změnit přetažením a uloží se ve vašem prohlížeči.",
      "Horní lišta má vyhledávání, přepínač motivu (světlý/tmavý), nápovědu a notifikace.",
      "Notifikace (zvonek) zobrazují události vyžadující vaši pozornost (schválení, úkoly, smlouvy končící platnost).",
      "Klikem na své jméno vpravo nahoře otevřete Profil (heslo, 2FA), Nastavení a (administrátoři) Administraci.",
      "Detailní dokumentace modulů: odkazy v sekci „Detailní dokumentace“ nebo přímo /help/…",
    ],
    quickSteps: [
      "Z dashboardu se prokliknete do libovolného modulu pomocí dlaždic nebo levého menu.",
      "Pro vyhledávání napříč moduly použijte horní pole „Vyhledat…“.",
      "Sledujte zvonek – červený badge = nepřečtené notifikace, oranžový = události ke schválení v kalendáři.",
      "Pokud potřebujete pomoc v konkrétním modulu, otevřete tuto nápovědu na jeho stránce – obsah se přizpůsobí.",
      "Své údaje (jméno, e-mail, heslo) měníte v Profilu, vzhled a předvolby v Nastavení.",
    ],
    tips: [
      "Tmavý motiv šetří oči – přepnete jej ikonou slunce/měsíce vedle nápovědy.",
      "Položky menu, které nevidíte, máte pravděpodobně bez přístupu – zkuste se obrátit na administrátora.",
    ],
    shortcuts: [
      { keys: "?", action: "Otevřít nápovědu" },
      { keys: "Esc", action: "Zavřít panely a dialogy" },
    ],
    docs: [
      { label: "Stručný manuál hotových modulů", href: "/help/manual-moduly-hotove" },
    ],
  },

  calendar: {
    key: "calendar",
    module: "calendar",
    icon: Calendar,
    title: "Kalendář",
    path: "/calendar",
    intro:
      "Plánování událostí, absencí a schvalování vybraných typů událostí (např. Dovolená, Osobní, Schůzka Praha, Služební cesta, Lékař) přes zástup a vedoucího.",
    features: [
      "Týdenní, měsíční a seznamové zobrazení.",
      "Osobní a globální pohled.",
      "Vyhledávání podle textu i osob.",
      "Vytvoření, úprava, smazání a přesun události (drag & drop).",
      "Dvoufázové schvalování u typů s povinným zástupem (zástup → vedoucí).",
      "Pozvánky na další účastníky (seznam pozvaných osob v detailu).",
      "Kontrola kolize zástupu mimo firmu při plánování/úpravě.",
      "Připomínky v aplikaci a e-mailem před začátkem události.",
      "Export kalendáře do .ics (Outlook/Google).",
      "Soukromé události – viditelné jen vám, skryté v globálním kalendáři.",
    ],
    quickSteps: [
      "Otevřete Kalendář a zvolte pohled (Týden / Měsíc / Seznam).",
      "Přepněte Globální nebo Osobní kalendář.",
      "Novou událost vytvořte kliknutím do mřížky nebo tlačítkem pro přidání události.",
      "U typu se schvalováním vždy vyberte zástup.",
      "Volitelně přidejte další účastníky do pole pozvánek.",
      "U služební cesty vyplňte popis kam/ proč (povinné pro schválení).",
      "Pro osobní poznámku jen pro sebe zaškrtněte Soukromá událost.",
      "Sledujte stavy schválení v dashboardu a notifikacích.",
      "Pro napojení do Outlook/Google použijte export .ics.",
    ],
    tips: [
      "Seznamové pohledy ukazují období po 14 dnech a hodí se na rychlou kontrolu.",
      "Po přesunu dovolené/osobní události se schvalování obnoví od začátku.",
      "Pokud systém hlásí kolizi zástupu, zvolte jiného zástupa nebo změňte termín.",
    ],
    docs: [
      { label: "Detailní manuál (uživatel)", href: "/help/kalendar-navod-uzivatel" },
      { label: "Kompletní dokumentace modulu", href: "/help/modul-kalendar" },
      { label: "Specifikace dvoufázového schvalování", href: "/help/kalendar-schvalovani-faze2" },
    ],
  },

  contacts: {
    key: "contacts",
    module: "contacts",
    icon: Users,
    title: "Kontakty",
    path: "/contacts",
    intro: "Centrální evidence zaměstnaneckých kontaktů s rychlým vyhledáváním a importem/exportem.",
    features: [
      "Přehled kontaktů v tabulce i kartách.",
      "Filtrování podle oddělení a vyhledávání (jméno, e-mail, telefon).",
      "Detail kontaktu a správa kontaktů podle oprávnění.",
      "Export a import CSV.",
    ],
    quickSteps: [
      "Otevřete Kontakty.",
      "Vyhledejte osobu podle jména, e-mailu nebo telefonu.",
      "Použijte filtr oddělení pro zpřesnění.",
      "Přepněte Seznam nebo Karty podle potřeby.",
      "Exportujte data tlačítkem Export CSV.",
      "S oprávněním zápisu použijte Import CSV nebo Přidat kontakt.",
    ],
    tips: [
      "Pro hromadné změny používejte import.",
      "Po importu ověřte klíčové kontakty v detailu.",
      "Osobní telefon a e-mail (pokud je vyplněn) se zobrazí v telefonním seznamu podle oprávnění.",
    ],
  },

  equipment: {
    key: "equipment",
    module: "equipment",
    icon: Laptop,
    title: "Majetek",
    path: "/equipment",
    intro:
      "Evidence vybavení, jeho stavů, požadavků na techniku a přiřazení zaměstnancům včetně tisku protokolů.",
    features: [
      "Přehled majetku (moje vybavení / vše podle oprávnění).",
      "Správa přiřazení majetku.",
      "Workflow požadavků na techniku.",
      "Tisk protokolů předání a vrácení.",
    ],
    quickSteps: [
      "Otevřete Majetek a pracujte v záložce Vybavení.",
      "Podle oprávnění přepněte pohled na své nebo veškeré vybavení.",
      "V akcích položky řešte detail, úpravy, přiřazení a status.",
      "V záložce Požadavky zpracujte požadavky na techniku.",
      "V Přiřazení kontrolujte aktivní zápůjčky.",
      "Tiskněte Předání a Vrácení protokoly.",
    ],
    tips: [
      "U položek bez data nákupu systém dopočítává stáří od data zápisu.",
      "Při vrácení majetku vždy aktualizujte stav i dokumentaci.",
      "Požadavek na techniku prochází dvoufázovým schvalováním: stanovisko IT → schválení Vedení.",
    ],
    docs: [
      { label: "Schvalovací proces požadavků na techniku", href: "/help/modul-majetek-pozadavky" },
    ],
  },

  ukoly: {
    key: "ukoly",
    module: "ukoly",
    icon: ClipboardList,
    title: "Úkoly",
    path: "/ukoly",
    intro: "Zadávání, sledování a vyhodnocování pracovních úkolů s notifikacemi a archivem.",
    features: [
      "Zakládání úkolů s termínem, prioritou, přílohou a příjemci.",
      "Přiřazení uživateli i oddělením.",
      "Stavy úkolu (open, in_progress, done, cancelled).",
      "Notifikace a e-mail při přidělení a změně termínu.",
      "Archiv, statistiky a export archivu (CSV/XLSX).",
    ],
    quickSteps: [
      "Otevřete Úkoly a založte nový úkol.",
      "Vyplňte alespoň jednoho příjemce (uživatel nebo oddělení).",
      "Nastavte termín splnění a případně urgentnost.",
      "Po převzetí potvrďte rozpracování.",
      "Po dokončení potvrďte splnění (úkol se přesune do archivu).",
      "Pro přehledy využijte Statistiky a export archivu.",
    ],
    tips: [
      "Změny termínu dělejte přímo v detailu, aby se odeslaly notifikace.",
      "V kalendáři se zobrazují jen aktivní úkoly (ne hotové/zrušené).",
    ],
    docs: [{ label: "Kompletní dokumentace modulu", href: "/help/modul-ukoly" }],
  },

  personalistika: {
    key: "personalistika",
    module: "personalistika",
    icon: BriefcaseBusiness,
    title: "Personalistika",
    path: "/personalistika",
    intro: "Správa dotazníků uchazečů, pracovních pozic a evidence brigádníků.",
    features: [
      "Evidence uchazečů a jejich stavů.",
      "Detail uchazeče včetně rozšířených dat dotazníku.",
      "Správa příloh (CV, PDF dokumenty).",
      "Správa pracovních pozic (přidání, aktivace/deaktivace, smazání).",
      "Evidence brigádníků (jméno, telefon, e-mail, stav, poznámka).",
    ],
    quickSteps: [
      "Otevřete Personalistika.",
      "V záložce Dotazníky filtrujte a vyberte uchazeče.",
      "V detailu upravte údaje, stav a interní poznámky.",
      "Nahrajte nebo smažte přílohy podle potřeby.",
      "Uložte změny.",
      "V záložce Pracovní pozice spravujte seznam pozic.",
      "V záložce Brigádníci přidávejte a upravujte krátkodobé pracovníky.",
    ],
    tips: [
      "Pro náborovou schůzku nastavte status na Pozván.",
      "U přijatých kandidátů doplňte poznámky pro snadnější onboarding.",
      "U brigádníků využijte stav (Student, Důchodce, OSVČ…) pro rychlou orientaci v evidenci.",
      "Při nahrání CV lze použít automatickou extrakci údajů z PDF (pokud je v UI dostupná).",
    ],
  },

  contracts: {
    key: "contracts",
    module: "contracts",
    icon: FileText,
    title: "Evidence smluv",
    path: "/contracts",
    intro: "Centrální evidence smluv s upozorněním na blížící se konec platnosti a workflow schvalování.",
    features: [
      "Přehled smluv s filtry (typ, stav, platnost, fulltext).",
      "Detail smlouvy s přílohami a náhledem PDF.",
      "Extrakce údajů z PDF při zakládání smlouvy.",
      "Vícekrokové schvalovací workflow (návrh → schválení → podpis → archiv).",
      "Upozornění na končící platnost (90/60/30 dní).",
      "Export seznamu do CSV.",
    ],
    quickSteps: [
      "Otevřete Evidence smluv.",
      "Použijte filtry pro nalezení smlouvy (typ, platnost, hledaný text).",
      "Otevřete detail smlouvy a zkontrolujte přílohy (náhled PDF u přílohy).",
      "Nová smlouva – vyplňte údaje, volitelně nahrajte PDF a použijte extrakci polí.",
      "Sledujte upozornění na končící platnost v dashboardu i notifikacích.",
      "Schvalovatelé řeší žádosti přímo v detailu smlouvy.",
    ],
    tips: [
      "Smlouvy končící do 90 dnů se objevují i na úvodní stránce.",
      "Při změně typu smlouvy zkontrolujte schvalovací osoby.",
    ],
    docs: [{ label: "Kompletní dokumentace modulu", href: "/help/modul-evidence-smluv" }],
  },

  planovani: {
    key: "planovani",
    module: "planovani",
    icon: CalendarDays,
    title: "Plánování výroby",
    path: "/planovani",
    intro: "Plánování výrobních zakázek a kapacit strojů – přehled zatížení, termínů a výjimek.",
    features: [
      "Přehled zakázek a strojů.",
      "Plán pracovní doby a výjimky (svátky, údržba).",
      "Kapacitní výpočet a vytížení strojů.",
      "Vazba na modul Výroba.",
    ],
    quickSteps: [
      "Otevřete Plánování výroby.",
      "Vyberte období a stroj/oddělení.",
      "Zkontrolujte vytížení a případné kolize.",
      "Upravte plán pracovní doby nebo přidejte výjimku.",
      "Změny propojte s navazující Výrobou.",
    ],
    tips: [
      "Při změně směn zkontrolujte plánované zakázky na příští týden.",
      "Výjimky (např. svátky) zadávejte s předstihem, aby se nepromítly do termínů.",
    ],
  },

  vyroba: {
    key: "vyroba",
    module: "vyroba",
    icon: Factory,
    title: "Výroba",
    path: "/vyroba",
    intro: "Modul výroba (cenina IG52) – evidence výrobních zakázek, výpočtů a tisků protokolů.",
    features: [
      "Přehled výrobních zakázek.",
      "Výpočty (rozměry, množství, formáty).",
      "Tisk PDF a TXT protokolů.",
      "Vazba na Plánování výroby.",
    ],
    quickSteps: [
      "Otevřete Výroba a zvolte zakázku.",
      "Doplňte / zkontrolujte parametry.",
      "Spusťte výpočet.",
      "Vytiskněte protokol (PDF/TXT) podle potřeby.",
      "Stav zakázky aktualizujte při dokončení.",
    ],
    tips: [
      "Pro znovuvýpočet stačí změnit parametry – výsledky se přepočítají automaticky.",
      "Pro problémy s tiskem viz dokument „Řešení tisku“.",
    ],
    docs: [
      { label: "Uživatelský manuál", href: "/help/manual-vyroba" },
      { label: "Kompletní dokumentace", href: "/help/dokumentace-kompletni-vyrobaceniny" },
      { label: "Návrh modulu", href: "/help/navrh-modul-vyroba" },
      { label: "Řešení tisku", href: "/help/vyroba-tisk" },
    ],
  },

  iml: {
    key: "iml",
    module: "iml",
    icon: Package,
    title: "IML",
    path: "/iml",
    intro:
      "Správa zákazníků, produktů (etikety IML), poptávek a objednávek včetně tiskových dat, Pantone barev a napojení na katalog materiálů.",
    features: [
      "Dashboard se statistikami a konverzí poptávek.",
      "Zákazníci – kontakty, dodací adresy, import/export.",
      "Produkty – taby (výseky, fólie, barvy), verzování PDF, náhled obrázku.",
      "Poptávky – evidence a konverze na objednávku.",
      "Objednávky – položky, snapshot adresy, tisk, export CSV/Excel/XML.",
      "Report Pantone – plánovaná spotřeba barev.",
      "Vlastní pole a import/export v nastavení.",
    ],
    quickSteps: [
      "Otevřete IML dashboard a zvolte sekci (Zákazníci / Produkty / Poptávky / Objednávky).",
      "Založte zákazníka a produkt; nahrajte PDF tiskových dat a nastavte Pantone.",
      "V produktu vyberte materiály z katalogu (fólie, barva, …), pokud máte přístup.",
      "Vytvořte poptávku nebo rovnou objednávku; u poptávky použijte Konvertovat na objednávku.",
      "Pro hromadné změny použijte import na příslušné stránce.",
    ],
    tips: [
      "Před importem exportujte aktuální data jako zálohu.",
      "Historii verzí PDF najdete v detailu produktu.",
      "Uživatelé s pouze iml:read vidí katalog materiálů, ale nemusí ho editovat.",
    ],
    docs: [
      { label: "Kompletní dokumentace modulu IML", href: "/help/modul-iml" },
      { label: "Implementační plán rozšíření (newsec)", href: "/help/iml-newsec" },
    ],
  },

  materialy: {
    key: "materialy",
    /** Čtení mají i uživatelé s iml:read – filtr v draweru neomezujeme na module materialy */
    module: null,
    icon: Layers,
    title: "Katalog materiálů",
    path: "/materialy",
    intro:
      "Evidence papírů, fólií, barev a laků včetně bezpečnostních listů (SDS), technických listů a certifikátů.",
    features: [
      "Čtyři kategorie: Papír, Fólie, Barvy, Laky.",
      "Vyhledávání napříč katalogem z úvodní stránky.",
      "Přílohy SDS, TDS, certifikát (PDF, obrázky, Office).",
      "Platnost certifikátu a stav aktivní/neaktivní.",
      "Propojení s produkty IML (výběr materiálu na produktu).",
    ],
    quickSteps: [
      "Otevřete Katalog materiálů a zvolte kategorii nebo vyhledejte materiál.",
      "V seznamu otevřete detail materiálu.",
      "Nahrajte SDS/TDS/certifikát (s oprávněním zápisu).",
      "Při úpravě doplňte výrobce, kód a datum platnosti certifikátu.",
    ],
    tips: [
      "Uživatelé IML s read přístupem katalog vidí, ale nemusí mít právo zápisu.",
      "Před smazáním materiálu zkontrolujte vazby na produkty IML.",
    ],
    docs: [{ label: "Kompletní dokumentace modulu", href: "/help/modul-materialy" }],
  },

  kiosk: {
    key: "kiosk",
    module: "kiosk",
    icon: Tv,
    title: "Kiosk Monitory",
    path: "/kiosk",
    intro: "Správa obsahu zobrazovaného na kioskových monitorech (prezentace, oznámení).",
    features: [
      "Seznam aktivních prezentací.",
      "Plánování zobrazení a rotace.",
      "Aktivace/deaktivace bez nutnosti restartu kiosku.",
    ],
    quickSteps: [
      "Otevřete Kiosk Monitory.",
      "Zkontrolujte seznam prezentací a jejich stav.",
      "Novou prezentaci přidejte tlačítkem Přidat.",
      "Nastavte období zobrazení a pořadí v rotaci.",
      "Aktivujte / deaktivujte podle potřeby.",
    ],
    tips: ["Změny se na kioscích projeví při příští obnově."],
  },

  "phone-list": {
    key: "phone-list",
    module: null,
    icon: Phone,
    title: "Telefonní seznam",
    path: "/phone-list",
    intro: "Rychlý přehled telefonních linek a kontaktů.",
    features: [
      "Vyhledávání podle jména a oddělení.",
      "Tisková verze seznamu.",
    ],
    quickSteps: [
      "Otevřete Telefonní seznam.",
      "Vyhledejte osobu nebo linku.",
      "Pro tisk použijte funkci tisku v prohlížeči.",
    ],
  },

  training: {
    key: "training",
    module: "training",
    icon: GraduationCap,
    title: "IT Školení",
    path: "/training",
    intro: "Evidence IT školení – přehled témat, účast uživatelů a potvrzení absolvování.",
    features: [
      "Seznam školení a jejich termínů.",
      "Sledování absolvování po uživatelích.",
      "Správa materiálů (s oprávněním zápisu).",
    ],
    quickSteps: [
      "Otevřete IT Školení.",
      "Vyberte školení a otevřete detail.",
      "Potvrďte absolvování (pokud máte školení přidělené).",
      "S oprávněním zápisu spravujte termíny a materiály.",
    ],
  },

  projekty: {
    key: "projekty",
    module: "projekty",
    icon: KanbanSquare,
    title: "Projekty",
    path: "/projekty",
    intro:
      "Projektové nástěnky s kartami úkolů — kanban, seznam a kalendář, komentáře, přílohy, checklisty a osobní To-Do list.",
    features: [
      "Nástěnky se sloupci a kartami (drag & drop, štítky, termíny, členové).",
      "Tři pohledy: Kanban, Seznam, Kalendář — přepínání záložkami nad boardem.",
      "Detail karty: popis, checklisty, komentáře se zmínkami, přílohy, historie aktivit.",
      "Moje karty — přehled karet napříč boardy, kde jste členem.",
      "Můj To Do list — osobní úkoly s možností povýšit úkol na kartu boardu.",
    ],
    quickSteps: [
      "Otevřete Projekty → Nástěnky a vyberte board (nebo vytvořte nový).",
      "Kartu přidáte tlačítkem + v patičce sloupce, přesouváte ji tažením.",
      "Klikem na kartu otevřete detail; odkaz na kartu lze zkopírovat a poslat kolegovi.",
      "Paletu příkazů otevřete zkratkou Ctrl+K (na Macu ⌘K) — skok na board, kartu i akce.",
    ],
    tips: [
      "Hromadné akce: na počítači označte více karet Ctrl/⌘+klikem, rozsah Shift+klikem.",
      "Filtry nad boardem (hledání, členové, štítky, termín) se ukládají do URL — vyfiltrovaný pohled lze poslat odkazem.",
    ],
    shortcuts: [
      { keys: "Ctrl/⌘+K", action: "Paleta příkazů (hledání a akce)" },
      { keys: "Ctrl/⌘+Shift+U", action: "Nový osobní úkol (quick capture)" },
      { keys: "Esc", action: "Zavřít dialog / zrušit výběr karet" },
    ],
  },

  admin: {
    key: "admin",
    module: null,
    requiresAdmin: true,
    icon: Wrench,
    title: "Administrace",
    path: "/admin",
    intro: "Sekce pro administrátory – uživatelé, role, oddělení, typy smluv, reporty a globální nastavení.",
    features: [
      "Správa uživatelů (přidání, deaktivace, role, povinné 2FA).",
      "Správa rolí a oprávnění modulů.",
      "Správa oddělení, typů smluv a schvalovatelů kalendáře podle oddělení.",
      "Sdílené e-mailové schránky (přiřazení uživatelům).",
      "Reporty napříč moduly a audit log.",
      "Globální nastavení aplikace (e-maily, integrace).",
    ],
    quickSteps: [
      "Vyberte podsekci v levém menu Administrace.",
      "Změny se projeví okamžitě – buďte opatrní u rolí a oprávnění.",
      "Pro hromadné změny uživatelů využijte filtry a hromadné akce.",
      "Reporty (BarChart3) najdete pod Administrace → Reporty.",
    ],
    tips: [
      "Vždy testujte nové role na testovacím účtu, než je nasadíte do produkce.",
      "Globální e-mailová nastavení ovlivňují všechna automatická upozornění.",
      "Nové uživatele doporučujeme zakládat s aktivačním e-mailem – uživatel si heslo nastaví sám, admin ho nevidí.",
    ],
    docs: [
      { label: "Obnova hesla, aktivační odkazy, politika hesla", href: "/help/auth-sprava-hesel" },
    ],
  },

  profile: {
    key: "profile",
    module: null,
    icon: User,
    title: "Profil",
    path: "/profile",
    intro: "Vaše osobní údaje, e-mail, heslo a dvoufaktorové ověření (2FA).",
    features: [
      "Změna jména, e-mailu, telefonu.",
      "Změna hesla.",
      "Nahrání podpisu pro e-mailovou komunikaci.",
      "Nastavení 2FA (Google Authenticator) – pokud admin vyžaduje nebo dobrovolně.",
    ],
    quickSteps: [
      "Otevřete Profil.",
      "Upravte potřebné údaje a uložte.",
      "Pro změnu hesla zadejte staré a dvakrát nové heslo.",
      "Pokud je vyžadováno 2FA, naskenujte QR kód a ověřte kód z aplikace.",
    ],
    tips: [
      "Záložní kódy pro 2FA si uložte na bezpečné místo – zobrazí se jen při aktivaci.",
    ],
    docs: [
      {
        label: "Obnova hesla, 2FA, politika hesla",
        href: "/help/auth-sprava-hesel",
      },
    ],
  },

  settings: {
    key: "settings",
    module: null,
    icon: Settings,
    title: "Nastavení",
    path: "/settings",
    intro: "Vaše osobní předvolby (např. notifikace, vzhled).",
    features: [
      "Předvolby notifikací.",
      "Předvolby zobrazení.",
    ],
    quickSteps: [
      "Otevřete Nastavení.",
      "Upravte své předvolby.",
      "Uložte změny – aplikují se okamžitě.",
    ],
  },

  fallback: {
    key: "fallback",
    module: null,
    icon: HelpCircle,
    title: "Nápověda",
    intro:
      "Pro tuto stránku nemáme zatím konkrétní nápovědu. Podívejte se na obecnou nápovědu k aplikaci.",
    features: [],
    quickSteps: [
      "Použijte tlačítko „Přepnout na nápovědu k aplikaci“ níže.",
      "Pokud potřebujete pomoc s konkrétním modulem, otevřete jej v levém menu a klikněte znovu na ?",
    ],
  },
};
