export interface DocumentDisclaimer {
  title: string;
  text: string;
}

export interface DocumentMetadata {
  docCode: string;
  docName: string;
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

export const DEFAULT_DOCUMENT_METADATA: DocumentMetadata = {
  docCode: "",
  docName: "",
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
