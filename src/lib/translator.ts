export const LANGUAGES = [
  { code: "cs", label: "Čeština" },
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "sk", label: "Slovenčina" },
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
  allProperties: NotionPropertyMeta[];
}

export interface TranslatorConfig {
  statusProperty: string;
  statusValue: string;
  doneStatusValue: string;
  sourceLanguage: string;
  targetLanguages: string[];
  // Mapping: language code -> Notion property name that holds the text in that language
  languagePropertyMap: Record<string, string>;
}

const STORAGE_KEY = "translator-config-v1";

export function loadConfig(): TranslatorConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TranslatorConfig;
  } catch {
    return null;
  }
}

export function saveConfig(config: TranslatorConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}
