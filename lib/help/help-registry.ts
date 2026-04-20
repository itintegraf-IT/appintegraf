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
  Tv,
  Phone,
  GraduationCap,
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
      "INTEGRAF je interní portál sdružující evidenci kontaktů, majetku, kalendář, úkoly, smlouvy, výrobu, IML a další moduly. Tato nápověda vás rychle provede orientací v aplikaci.",
    features: [
      "Levé menu (sidebar) obsahuje všechny moduly, ke kterým máte přístup.",
      "Pořadí položek menu si můžete změnit přetažením a uloží se ve vašem prohlížeči.",
      "Horní lišta má vyhledávání, přepínač motivu (světlý/tmavý), nápovědu a notifikace.",
      "Notifikace (zvonek) zobrazují události vyžadující vaši pozornost (schválení, úkoly, smlouvy končící platnost).",
      "Klikem na své jméno vpravo nahoře otevřete Profil, Nastavení a (administrátoři) Administraci.",
    ],
    quickSteps: [
      "Z dashboardu se prokliknete do libovolného modulu pomocí dlaždic nebo levého menu.",
      "Pro vyhledávání napříč moduly použijte horní pole „Vyhledat…“.",
      "Sledujte zvonek – červená tečka znamená novou notifikaci ke schválení/přečtení.",
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
      "Plánování událostí, absencí a schvalování vybraných typů událostí (Dovolená, Osobní) přes zástup a vedoucího.",
    features: [
      "Týdenní, měsíční a seznamové zobrazení.",
      "Osobní a globální pohled.",
      "Vyhledávání podle textu i osob.",
      "Vytvoření, úprava, smazání a přesun události (drag & drop).",
      "Dvoufázové schvalování u typů Dovolená a Osobní (zástup → vedoucí).",
      "Export kalendáře do .ics (Outlook/Google).",
    ],
    quickSteps: [
      "Otevřete Kalendář a zvolte pohled (Týden / Měsíc / Seznam).",
      "Přepněte Globální nebo Osobní kalendář.",
      "Novou událost vytvořte kliknutím do mřížky nebo tlačítkem pro přidání události.",
      "U typu Dovolená/Osobní vždy vyberte zástup.",
      "Sledujte stavy schválení v dashboardu a notifikacích.",
      "Pro napojení do Outlook/Google použijte export .ics.",
    ],
    tips: [
      "Seznamové pohledy ukazují období po 14 dnech a hodí se na rychlou kontrolu.",
      "Po přesunu dovolené/osobní události se schvalování obnoví od začátku.",
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
    intro: "Správa dotazníků uchazečů a evidence pracovních pozic.",
    features: [
      "Evidence uchazečů a jejich stavů.",
      "Detail uchazeče včetně rozšířených dat dotazníku.",
      "Správa příloh (CV, PDF dokumenty).",
      "Správa pracovních pozic (přidání, aktivace/deaktivace, smazání).",
    ],
    quickSteps: [
      "Otevřete Personalistika.",
      "V záložce Dotazníky filtrujte a vyberte uchazeče.",
      "V detailu upravte údaje, stav a interní poznámky.",
      "Nahrajte nebo smažte přílohy podle potřeby.",
      "Uložte změny.",
      "V záložce Pracovní pozice spravujte seznam pozic.",
    ],
    tips: [
      "Pro náborovou schůzku nastavte status na Pozván.",
      "U přijatých kandidátů doplňte poznámky pro snadnější onboarding.",
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
      "Přehled smluv s filtry (typ, stav, platnost).",
      "Detail smlouvy s přílohami.",
      "Schvalovací workflow.",
      "Upozornění na končící platnost (90/60/30 dní).",
      "Notifikace pro odpovědné osoby.",
    ],
    quickSteps: [
      "Otevřete Evidence smluv.",
      "Použijte filtry pro nalezení smlouvy (typ, platnost, hledaný text).",
      "Otevřete detail smlouvy a zkontrolujte přílohy.",
      "Pomocí tlačítka Nová smlouva založte záznam a přiložte dokumenty.",
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
    intro: "Modul IML – evidence šablon/etiket s vlastními poli, importem a exportem.",
    features: [
      "Přehled IML záznamů.",
      "Vlastní pole (custom fields).",
      "Import a export dat.",
      "Audit změn.",
    ],
    quickSteps: [
      "Otevřete IML.",
      "Použijte filtry pro nalezení záznamu.",
      "Pro hromadné práce použijte import / export.",
      "V detailu upravujte data včetně vlastních polí.",
      "Změny se zaznamenávají do auditu.",
    ],
    tips: [
      "Před importem si vyexportujte aktuální stav jako zálohu.",
      "Vlastní pole definujte předem – usnadníte si dlouhodobou správu.",
    ],
    docs: [{ label: "Kompletní dokumentace modulu IML", href: "/help/modul-iml" }],
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

  admin: {
    key: "admin",
    module: null,
    requiresAdmin: true,
    icon: Wrench,
    title: "Administrace",
    path: "/admin",
    intro: "Sekce pro administrátory – uživatelé, role, oddělení, typy smluv, reporty a globální nastavení.",
    features: [
      "Správa uživatelů (přidání, deaktivace, role).",
      "Správa rolí a oprávnění modulů.",
      "Správa oddělení a typů smluv.",
      "Reporty napříč moduly.",
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
    intro: "Vaše osobní údaje, e-mail a heslo.",
    features: [
      "Změna jména, e-mailu, telefonu.",
      "Změna hesla.",
      "Nahrání podpisu pro e-mailovou komunikaci.",
    ],
    quickSteps: [
      "Otevřete Profil.",
      "Upravte potřebné údaje.",
      "Uložte změny.",
      "Pro změnu hesla zadejte staré a dvakrát nové heslo.",
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
