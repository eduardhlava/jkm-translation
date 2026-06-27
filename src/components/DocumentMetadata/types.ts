export interface DocumentDisclaimer {
  title: string;
  text: string;
}

export interface DocumentMetadata {
  docCode: string;
  docName: string;
  language: string;
  imageLabelPrefix: string;
  coverImageUrl: string;
  coverImageAlt: string;
  disclaimerWarning: DocumentDisclaimer;
  disclaimerNotice: DocumentDisclaimer;
  disclaimerConfidential: DocumentDisclaimer;
  revision: string;
  copyright: string;
  footerVersion: string;
  showToc: boolean;
}

// Language options — code + native name in the language itself.
export const DOCUMENT_LANGUAGES: Array<{ code: string; nativeName: string }> = [
  { code: "en", nativeName: "English" },
  { code: "de", nativeName: "Deutsch" },
  { code: "ru", nativeName: "Русский" },
  { code: "it", nativeName: "Italiano" },
  { code: "es", nativeName: "Español" },
  { code: "pl", nativeName: "Polski" },
  { code: "fr", nativeName: "Français" },
  { code: "sk", nativeName: "Slovenčina" },
  { code: "ua", nativeName: "Українська" },
  { code: "cz", nativeName: "Čeština" },
  { code: "fi", nativeName: "Suomi" },
  { code: "se", nativeName: "Svenska" },
  { code: "ro", nativeName: "Română" },
];

export const DEFAULT_DOCUMENT_METADATA: DocumentMetadata = {
  docCode: "",
  docName: "",
  language: "cz",
  imageLabelPrefix: "Obrázek č. ",
  coverImageUrl: "",
  coverImageAlt: "",
  disclaimerWarning: {
    title: "VÝSTRAHA!",
    text:
      "Aby nedošlo k poranění osob nebo poškození technologického zařízení, musí se vykonávání prací uvedených v tomto návodu svěřit jen kvalifikovaným pracovníkům.",
  },
  disclaimerNotice: {
    title: "UPOZORNĚNÍ!",
    text:
      "Dostupnost a konstrukční provedení a parametry všech vlastností, funkcí a variantního vybavení podléhá změnám bez předchozího upozornění.\nObrázky, schémata a ilustrace mají pouze orientační charakter.\nPro podrobnosti a další informace kontaktujte společnost JK Machinery a.s. nebo jejich prodejního zástupce ve vaší zemi.",
  },
  disclaimerConfidential: {
    title: "DŮVĚRNÁ INFORMACE",
    text:
      "Společnosti JK Machinery a.s., Česká republika. Tato informace se zapůjčuje uživateli k důvěrnému použití, na požádání se musí vrátit a zainteresované strany jsou navzájem srozuměny s tím, že nebude použita žádným způsobem, který by byl na újmu zájmům společnosti JK Machinery a.s. a/nebo jejím partnerům.",
  },
  revision: "",
  copyright: "© JK Machinery a.s., Czech Republic, all rights reserved",
  footerVersion: "",
  showToc: true,
};

export function mergeMetadata(partial: Partial<DocumentMetadata> | undefined | null): DocumentMetadata {
  const base = DEFAULT_DOCUMENT_METADATA;
  const p = partial ?? {};
  return {
    ...base,
    ...p,
    disclaimerWarning: { ...base.disclaimerWarning, ...(p.disclaimerWarning ?? {}) },
    disclaimerNotice: { ...base.disclaimerNotice, ...(p.disclaimerNotice ?? {}) },
    disclaimerConfidential: { ...base.disclaimerConfidential, ...(p.disclaimerConfidential ?? {}) },
  };
}
