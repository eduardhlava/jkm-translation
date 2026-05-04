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
  | "pageTitle"
  | "toTranslate"
  | "remainingToTranslate"
  | "machineCol"
  | "machineFilter"
  | "anyMachine"
  | "signIn"
  | "signOut"
  | "email"
  | "password"
  | "loginTitle"
  | "loginSubtitle"
  | "loginFailed"
  | "accountInactive"
  | "users"
  | "newUser"
  | "editUser"
  | "deleteUser"
  | "createUser"
  | "saveUser"
  | "isActive"
  | "isAdmin"
  | "targetLangs"
  | "targetLangsHint"
  | "passwordOptional"
  | "confirmDelete"
  | "userSaved"
  | "userCreated"
  | "userDeleted"
  | "readOnlyTranslation"
  | "fullName"
  | "cancel";

type Dict = Record<TKey, string>;

const cz: Dict = {
  appName: "JKM Content Translator",
  appTagline: "Aplikace pro překládání obsahu JK Machinery",
  fullName: "Jméno a příjmení",
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
  toTranslate: "K překladu",
  machineCol: "Stroj",
  machineFilter: "Stroj",
  anyMachine: "Nezáleží",
  signIn: "Přihlásit",
  signOut: "Odhlásit",
  email: "E-mail",
  password: "Heslo",
  loginTitle: "Přihlášení",
  loginSubtitle: "Přihlaste se ke správě překladů",
  loginFailed: "Přihlášení selhalo",
  accountInactive: "Účet je deaktivován",
  users: "Uživatelé",
  newUser: "Nový uživatel",
  editUser: "Upravit uživatele",
  deleteUser: "Smazat",
  createUser: "Vytvořit",
  saveUser: "Uložit",
  isActive: "Aktivní",
  isAdmin: "Administrátor",
  targetLangs: "Cílové jazyky (může editovat překlad)",
  targetLangsHint: "Vyberte jazyky, ve kterých uživatel může upravovat překlad. Ostatní jazyky budou jen pro čtení.",
  passwordOptional: "Heslo (ponechte prázdné pro zachování)",
  confirmDelete: "Opravdu smazat tohoto uživatele?",
  userSaved: "Uživatel uložen",
  userCreated: "Uživatel vytvořen",
  userDeleted: "Uživatel smazán",
  readOnlyTranslation: "Pouze pro čtení – tento jazyk nemáte přiřazen",
  cancel: "Zrušit",
};

const en: Dict = {
  appName: "JKM Content Translator",
  appTagline: "App for translating JK Machinery content",
  fullName: "Full name",
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
  toTranslate: "To translate",
  machineCol: "Machine",
  machineFilter: "Machine",
  anyMachine: "Any",
  signIn: "Sign in",
  signOut: "Sign out",
  email: "Email",
  password: "Password",
  loginTitle: "Sign in",
  loginSubtitle: "Sign in to manage translations",
  loginFailed: "Sign-in failed",
  accountInactive: "Account is deactivated",
  users: "Users",
  newUser: "New user",
  editUser: "Edit user",
  deleteUser: "Delete",
  createUser: "Create",
  saveUser: "Save",
  isActive: "Active",
  isAdmin: "Administrator",
  targetLangs: "Target languages (translation editable)",
  targetLangsHint: "Pick languages the user can edit. Others will be read-only.",
  passwordOptional: "Password (leave blank to keep)",
  confirmDelete: "Really delete this user?",
  userSaved: "User saved",
  userCreated: "User created",
  userDeleted: "User deleted",
  readOnlyTranslation: "Read-only — this language is not assigned to you",
  cancel: "Cancel",
};

const ru: Dict = {
  appName: "JKM Content Translator",
  appTagline: "Приложение для перевода контента JK Machinery",
  fullName: "Имя и фамилия",
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
  toTranslate: "К переводу",
  machineCol: "Станок",
  machineFilter: "Станок",
  anyMachine: "Не важно",
  signIn: "Войти",
  signOut: "Выйти",
  email: "E-mail",
  password: "Пароль",
  loginTitle: "Вход",
  loginSubtitle: "Войдите для управления переводами",
  loginFailed: "Ошибка входа",
  accountInactive: "Учётная запись отключена",
  users: "Пользователи",
  newUser: "Новый пользователь",
  editUser: "Редактировать",
  deleteUser: "Удалить",
  createUser: "Создать",
  saveUser: "Сохранить",
  isActive: "Активен",
  isAdmin: "Администратор",
  targetLangs: "Целевые языки (можно редактировать перевод)",
  targetLangsHint: "Выберите языки, которые пользователь может редактировать.",
  passwordOptional: "Пароль (оставьте пустым, чтобы не менять)",
  confirmDelete: "Удалить пользователя?",
  userSaved: "Сохранено",
  userCreated: "Создано",
  userDeleted: "Удалено",
  readOnlyTranslation: "Только чтение — язык не назначен",
  cancel: "Отмена",
};

const pl: Dict = {
  appName: "JKM Content Translator",
  appTagline: "Aplikacja do tłumaczenia treści JK Machinery",
  fullName: "Imię i nazwisko",
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
  toTranslate: "Do tłumaczenia",
  machineCol: "Maszyna",
  machineFilter: "Maszyna",
  anyMachine: "Bez znaczenia",
  signIn: "Zaloguj",
  signOut: "Wyloguj",
  email: "E-mail",
  password: "Hasło",
  loginTitle: "Logowanie",
  loginSubtitle: "Zaloguj się, aby zarządzać tłumaczeniami",
  loginFailed: "Logowanie nie powiodło się",
  accountInactive: "Konto jest wyłączone",
  users: "Użytkownicy",
  newUser: "Nowy użytkownik",
  editUser: "Edytuj",
  deleteUser: "Usuń",
  createUser: "Utwórz",
  saveUser: "Zapisz",
  isActive: "Aktywny",
  isAdmin: "Administrator",
  targetLangs: "Języki docelowe (edycja tłumaczenia)",
  targetLangsHint: "Wybierz języki, w których użytkownik może edytować tłumaczenie.",
  passwordOptional: "Hasło (puste = bez zmian)",
  confirmDelete: "Na pewno usunąć użytkownika?",
  userSaved: "Zapisano",
  userCreated: "Utworzono",
  userDeleted: "Usunięto",
  readOnlyTranslation: "Tylko do odczytu — język nieprzypisany",
  cancel: "Anuluj",
};

const DICTS: Record<UiLang, Dict> = { cz, en, ru, pl };

export function t(lang: UiLang, key: TKey, vars?: Record<string, string | number>): string {
  let s = (DICTS[lang] ?? DICTS.cz)[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
