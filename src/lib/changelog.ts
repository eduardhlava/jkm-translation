export interface ChangelogEntry {
  version: string;
  /** ISO YYYY-MM-DD */
  date: string;
  changes: string[];
}

/** Newest first. The first entry defines the current app version. */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.12.0",
    date: "2026-10-21",
    changes: [
      "Dva obrázky na půl stránky pod sebou (Vlevo a Vpravo) se v PDF zobrazí vedle sebe.",
    ],
  },
  {
    version: "1.11.2",
    date: "2026-10-21",
    changes: [
      "Výběr piktogramu zobrazuje náhledy ikon.",
    ],
  },
  {
    version: "1.11.1",
    date: "2026-10-21",
    changes: [
      "Oprava: obrázek na půl stránky se zarovná vlevo/vpravo i bez navazujícího textu.",
    ],
  },
  {
    version: "1.11.0",
    date: "2026-10-21",
    changes: [
      "Obrázky lze vyřadit z číslování přepínačem Číslovat obrázek; označení číslovaných i nečíslovaných obrázků se nastavuje v Nastavení dokumentu.",
    ],
  },
  {
    version: "1.10.2",
    date: "2026-10-20",
    changes: [
      "Drobná vylepšení a opravy.",
    ],
  },
  {
    version: "1.10.1",
    date: "2026-10-20",
    changes: [
      "Kompaktnější nastavení obrázku a nová ikona menu buňky v tabulce.",
    ],
  },
  {
    version: "1.10.0",
    date: "2026-10-20",
    changes: [
      "Blok Obrázek + Tabulka lze rozdělit na samostatný obrázek a tabulku (ikona v záhlaví bloku).",
    ],
  },
  {
    version: "1.9.1",
    date: "2026-10-20",
    changes: [
      "Verze aplikace a log změn jsou dostupné i v seznamu dokumentů.",
    ],
  },
  {
    version: "1.9.0",
    date: "2026-10-20",
    changes: [
      "Tabulky: sousední buňky v řádku lze sloučit (Sloučit s buňkou vpravo / Zrušit sloučení).",
    ],
  },
  {
    version: "1.8.0",
    date: "2026-10-20",
    changes: [
      "Vedle obrázku na půl stránky se nově vypisuje i více navazujících textových bloků, dokud je místo.",
    ],
  },
  {
    version: "1.7.0",
    date: "2026-10-20",
    changes: [
      "Přehlednější uspořádání bloku Obrázek: zdroj obrázku, nastavení, náhled, popisek.",
      "Zobrazení verze aplikace a log změn (kliknutím na verzi vlevo dole).",
      "Volba automatického číslování nadpisů přesunuta do Nastavení dokumentu.",
    ],
  },
  {
    version: "1.6.0",
    date: "2026-10-20",
    changes: [
      "Nové piktogramy Výstraha, Výstraha – el. nebezpečí, Informace a Recyklace podle předlohy (v textu, u obrázků i v tabulkách).",
      "Piktogram Recyklace lze přidat i k textovému bloku.",
    ],
  },
  {
    version: "1.5.0",
    date: "2026-10-20",
    changes: [
      "Obrázek: volba Velikost (Plná šířka / Půl stránky) a Umístění (Vlevo / Vpravo / Střed).",
      "Text pod obrázkem na půl stránky obtéká vedle obrázku a pokračuje pod ním.",
      "Obrázek + Tabulka: volba Velikost, tabulka je vždy pod obrázkem.",
    ],
  },
  {
    version: "1.4.0",
    date: "2026-10-19",
    changes: [
      "Automatické uspořádání stránkování PDF: nadpisy nezůstávají osamocené na konci stránky a tabulky se nedělí mezi stránky.",
      "Náhled PDF lze otevřít vždy; pokud stránkování neodpovídá změnám, aplikace se zeptá.",
      "Číslo nadpisu v hlavičce bloku a kompaktní plovoucí lišta pro sbalení/rozbalení bloků.",
      "Menší okraje buněk tabulek v PDF; velké obrázky se už nepřekrývají s textem.",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-10-13",
    changes: [
      "Tučné písmo, kurzíva a podtržení i v buňkách tabulek (Ctrl/⌘+B, I, U).",
      "Název dokumentu v Notion je oddělený od nadpisu tištěného v PDF.",
      "Nový blok Horizontální mezera a větší mezery nad nadpisy v PDF.",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-10-12",
    changes: [
      "Formátování textu: horní a dolní index, vložení bez formátování a barva pozadí textu.",
      "Správa souborů a složek: mazání, slučování a nahrávání souborů.",
      "Opravy exportu do PDF.",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-09-15",
    changes: [
      "Rychlejší export dokumentu do Notion.",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-08-30",
    changes: [
      "Překlady: zvýrazněný vstupní jazyk, přehlednější stavy a tlačítka, načítání po 50 záznamech.",
      "Kontext překladu lze upravit přímo v tabulce.",
      "Piktogramy v buňkách tabulek.",
      "Převod CAD výkresů na obrázky a větší obrázky v PDF.",
    ],
  },
];

export const APP_VERSION = CHANGELOG[0].version;
export const APP_VERSION_DATE = CHANGELOG[0].date;

/** "2026-10-20" → "20. 10. 2026" */
export function formatCzechDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}. ${m}. ${y}`;
}
