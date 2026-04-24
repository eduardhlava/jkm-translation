export const LANGUAGES = [
  { code: "cz", label: "Čeština" },
  { code: "sk", label: "Slovenčina" },
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "pl", label: "Polski" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "it", label: "Italiano" },
  { code: "nl", label: "Nederlands" },
  { code: "pt", label: "Português" },
  { code: "hu", label: "Magyar" },
  { code: "ro", label: "Română" },
  { code: "uk", label: "Українська" },
  { code: "ru", label: "Русский" },
];

export interface NotionPropertyMeta {
  name: string;
  type: string;
}

export interface NotionItem {
  id: string;
  url: string;
  properties: Record<string, string>;
  allProperties?: NotionPropertyMeta[];
}

export interface AppSettings {
  // Notion property names follow conventions: {lang}, stav_{lang}, kontext_{lang}, příklad_věty_{lang}
  statusNew: string; // value in Notion meaning "new"
  statusReview: string; // value to write when user marks "Přeloženo"
  pageSize: number;
  uiLang: "cz" | "en" | "ru" | "pl";
}

const SETTINGS_KEY = "translator-settings-v2";

export const defaultSettings: AppSettings = {
  statusNew: "nový",
  statusReview: "ke_kontrole",
  pageSize: 20,
  uiLang: "cz",
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(s: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// Notion property name helpers
export const propText = (lang: string) => lang;
export const propStatus = (lang: string) => `stav_${lang}`;
export const propContext = (lang: string) => `kontext_${lang}`;
export const propExample = (lang: string) => `příklad_věty_${lang}`;

export const langLabel = (code: string) =>
  LANGUAGES.find((l) => l.code === code)?.label ?? code;
