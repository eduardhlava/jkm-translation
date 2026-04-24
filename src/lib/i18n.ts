export const UI_LANGUAGES = [
  { code: "cz", label: "Čeština" },
  { code: "en", label: "English" },
  { code: "ru", label: "Русский" },
  { code: "pl", label: "Polski" },
] as const;

export type UiLang = (typeof UI_LANGUAGES)[number]["code"];

export type TKey =
  | "appName"
  | "appTagline"
  | "settings"
  | "back"
  | "save"
  | "settingsSaved"
  | "uiLanguage"
  | "uiLanguageHint"
  | "statusMappingTitle"
  | "statusMappingHint"
  | "statusNewLabel"
  | "statusNewHint"
  | "statusReviewLabel"
  | "statusReviewHint"
  | "pageSizeLabel"
  | "saveSettings"
  | "sourceLang"
  | "targetLang"
  | "contextLang"
  | "loadN"
  | "updateBtn"
  | "noItems"
  | "sourceCol"
  | "translationCol"
  | "contextCol"
  | "exampleCol"
  | "statusCol"
  | "confirm"
  | "translated"
  | "openInNotion"
  | "translationPlaceholder"
  | "loadFailed"
  | "updateFailed"
  | "noConfirmed"
  | "updatedNofM"
  | "loadedN"
  | "noNewItems"
  | "sameLangError"
  | "pageTitle";

type Dict = Record<TKey, string>;

const cz: Dict = {
  appName: "JKM Content Translator",
  appTagline: "Překládej položky databáze a zapisuj zpět do Notion",
  settings: "Nastavení",
  back: "Zpět",
  save: "Uložit",
  settingsSaved: "Nastavení uloženo",
  uiLanguage: "Jazyk aplikace",
  uiLanguageHint: "Mění jazyk popisků v aplikaci.",
  statusMappingTitle: "Mapování stavů v Notion",
  statusMappingHint:
    "Property se jmenuje stav_{jazyk} (např. stav_en). Texty jsou ve sloupcích podle kódu jazyka (cz, en, …).",
  statusNewLabel: "Hodnota „nový“ v Notion",
  statusNewHint: "Filtr pro načítání položek.",
  statusReviewLabel: "Hodnota „přeloženo“ v Notion",
  statusReviewHint: "Tato hodnota se zapíše po kliknutí na „Aktualizovat“.",
  pageSizeLabel: "Počet položek na dávku",
  saveSettings: "Uložit nastavení",
  sourceLang: "Zdrojový jazyk",
  targetLang: "Cílový jazyk",
  contextLang: "Jazyk kontextu a příkladu",
  loadN: "Načíst {n} položek",
  updateBtn: "Aktualizovat ({n})",
  noItems: "Žádné položky. Vyber jazyky a klikni na „Načíst“.",
  sourceCol: "Zdroj",
  translationCol: "Překlad",
  contextCol: "Kontext",
  exampleCol: "Příklad věty",
  statusCol: "Stav",
  confirm: "Potvrdit",
  translated: "Přeloženo",
  openInNotion: "Otevřít v Notion",
  translationPlaceholder: "Překlad ({lang})…",
  loadFailed: "Načtení selhalo",
  updateFailed: "Aktualizace selhala",
  noConfirmed: "Žádné potvrzené položky",
  updatedNofM: "Aktualizováno {ok}/{total} položek",
  loadedN: "Načteno {n} položek",
  noNewItems: "Žádné položky se stavem „nový“",
  sameLangError: "Zdrojový a cílový jazyk musí být různé",
  pageTitle: "JKM Content Translator – překlady přímo z databáze",
};

const en: Dict = {
  appName: "JKM Content Translator",
  appTagline: "Translate database items and write back to Notion",
  settings: "Settings",
  back: "Back",
  save: "Save",
  settingsSaved: "Settings saved",
  uiLanguage: "App language",
  uiLanguageHint: "Changes the language of UI labels.",
  statusMappingTitle: "Status mapping in Notion",
  statusMappingHint:
    "The property is named stav_{lang} (e.g. stav_en). Texts live in columns by language code (cz, en, …).",
  statusNewLabel: "Value for “new” in Notion",
  statusNewHint: "Filter used when loading items.",
  statusReviewLabel: "Value for “translated” in Notion",
  statusReviewHint: "This value is written when you click “Update”.",
  pageSizeLabel: "Items per batch",
  saveSettings: "Save settings",
  sourceLang: "Source language",
  targetLang: "Target language",
  contextLang: "Context & example language",
  loadN: "Load {n} items",
  updateBtn: "Update ({n})",
  noItems: "No items. Pick languages and click “Load”.",
  sourceCol: "Source",
  translationCol: "Translation",
  contextCol: "Context",
  exampleCol: "Example sentence",
  statusCol: "Status",
  confirm: "Confirm",
  translated: "Translated",
  openInNotion: "Open in Notion",
  translationPlaceholder: "Translation ({lang})…",
  loadFailed: "Load failed",
  updateFailed: "Update failed",
  noConfirmed: "No confirmed items",
  updatedNofM: "Updated {ok}/{total} items",
  loadedN: "Loaded {n} items",
  noNewItems: "No items with status “new”",
  sameLangError: "Source and target language must differ",
  pageTitle: "JKM Content Translator – translate straight from your database",
};

const ru: Dict = {
  appName: "JKM Content Translator",
  appTagline: "Переводите записи базы и записывайте обратно в Notion",
  settings: "Настройки",
  back: "Назад",
  save: "Сохранить",
  settingsSaved: "Настройки сохранены",
  uiLanguage: "Язык приложения",
  uiLanguageHint: "Меняет язык интерфейса.",
  statusMappingTitle: "Соответствие статусов в Notion",
  statusMappingHint:
    "Свойство называется stav_{язык} (например, stav_en). Тексты хранятся в столбцах по коду языка (cz, en, …).",
  statusNewLabel: "Значение «новый» в Notion",
  statusNewHint: "Фильтр загрузки записей.",
  statusReviewLabel: "Значение «переведено» в Notion",
  statusReviewHint: "Записывается при нажатии «Обновить».",
  pageSizeLabel: "Записей в партии",
  saveSettings: "Сохранить настройки",
  sourceLang: "Исходный язык",
  targetLang: "Целевой язык",
  contextLang: "Язык контекста и примера",
  loadN: "Загрузить {n} записей",
  updateBtn: "Обновить ({n})",
  noItems: "Нет записей. Выберите языки и нажмите «Загрузить».",
  sourceCol: "Источник",
  translationCol: "Перевод",
  contextCol: "Контекст",
  exampleCol: "Пример предложения",
  statusCol: "Статус",
  confirm: "Подтвердить",
  translated: "Переведено",
  openInNotion: "Открыть в Notion",
  translationPlaceholder: "Перевод ({lang})…",
  loadFailed: "Ошибка загрузки",
  updateFailed: "Ошибка обновления",
  noConfirmed: "Нет подтверждённых записей",
  updatedNofM: "Обновлено {ok}/{total} записей",
  loadedN: "Загружено {n} записей",
  noNewItems: "Нет записей со статусом «новый»",
  sameLangError: "Исходный и целевой язык должны отличаться",
  pageTitle: "JKM Content Translator — переводы прямо из базы",
};

const pl: Dict = {
  appName: "JKM Content Translator",
  appTagline: "Tłumacz elementy bazy i zapisuj z powrotem do Notion",
  settings: "Ustawienia",
  back: "Wstecz",
  save: "Zapisz",
  settingsSaved: "Ustawienia zapisane",
  uiLanguage: "Język aplikacji",
  uiLanguageHint: "Zmienia język etykiet interfejsu.",
  statusMappingTitle: "Mapowanie statusów w Notion",
  statusMappingHint:
    "Właściwość nazywa się stav_{język} (np. stav_en). Teksty są w kolumnach wg kodu języka (cz, en, …).",
  statusNewLabel: "Wartość „nowy” w Notion",
  statusNewHint: "Filtr wczytywania elementów.",
  statusReviewLabel: "Wartość „przetłumaczone” w Notion",
  statusReviewHint: "Zapisywana po kliknięciu „Aktualizuj”.",
  pageSizeLabel: "Liczba elementów w partii",
  saveSettings: "Zapisz ustawienia",
  sourceLang: "Język źródłowy",
  targetLang: "Język docelowy",
  contextLang: "Język kontekstu i przykładu",
  loadN: "Wczytaj {n} elementów",
  updateBtn: "Aktualizuj ({n})",
  noItems: "Brak elementów. Wybierz języki i kliknij „Wczytaj”.",
  sourceCol: "Źródło",
  translationCol: "Tłumaczenie",
  contextCol: "Kontekst",
  exampleCol: "Przykładowe zdanie",
  statusCol: "Status",
  confirm: "Potwierdź",
  translated: "Przetłumaczone",
  openInNotion: "Otwórz w Notion",
  translationPlaceholder: "Tłumaczenie ({lang})…",
  loadFailed: "Błąd wczytywania",
  updateFailed: "Błąd aktualizacji",
  noConfirmed: "Brak potwierdzonych elementów",
  updatedNofM: "Zaktualizowano {ok}/{total} elementów",
  loadedN: "Wczytano {n} elementów",
  noNewItems: "Brak elementów ze statusem „nowy”",
  sameLangError: "Język źródłowy i docelowy muszą się różnić",
  pageTitle: "JKM Content Translator – tłumaczenia prosto z bazy",
};

const DICTS: Record<UiLang, Dict> = { cz, en, ru, pl };

export function t(lang: UiLang, key: TKey, vars?: Record<string, string | number>): string {
  let s = (DICTS[lang] ?? DICTS.cz)[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
