export interface ChangelogEntry {
  version: string;
  /** ISO YYYY-MM-DD */
  date: string;
  changes: string[];
}

/** Newest first. The first entry defines the current app version. */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.3.0",
    date: "2026-10-20",
    changes: [
      "Nové zobrazení verze aplikace a log změn (kliknutím na verzi vlevo dole).",
      "Volba automatického číslování nadpisů přesunuta do Nastavení dokumentu.",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-10-20",
    changes: [
      "Nové piktogramy Výstraha, Výstraha – el. nebezpečí, Informace a Recyklace podle předlohy klienta (v textu, u obrázků i v tabulkách).",
      "Piktogram Recyklace lze nově přidat i k textovému bloku.",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-10-20",
    changes: [
      "Obrázek: nová volba Velikost (Plná šířka / Půl stránky) a Umístění (Vlevo / Vpravo / Střed).",
      "Text pod obrázkem na půl stránky obtéká vedle obrázku a pokračuje pod ním.",
      "Obrázek + Tabulka: volba Velikost; tabulka je vždy pod obrázkem.",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-10-19",
    changes: ["Výchozí verze aplikace (editor dokumentů, překlady, synchronizace s Notion, export do PDF)."],
  },
];

export const APP_VERSION = CHANGELOG[0].version;
export const APP_VERSION_DATE = CHANGELOG[0].date;

/** "2026-10-20" → "20. 10. 2026" */
export function formatCzechDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}. ${m}. ${y}`;
}
