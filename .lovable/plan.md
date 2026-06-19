## Cíl

Aplikace dnes ukládá do Notion jen „obsah" bloků. Vše ostatní (piktogramy, šablona/template, zarovnání, velikost textu, header-row tabulky, šířka obrázku, dokumentová metadata jako `docCode`, `docName`, `showToc`, disclaimery, cover obrázek, revize, footer, copyright) žije pouze v Supabase v `document_blocks.settings` a `blocks`. Po duplikaci stránky v Notion se ztratí.

Návrh přidá do Notion **dvě úrovně metadat** (dokument + blok), tak aby:
- duplikát v Notion → import do aplikace obnovil 100 % nastavení,
- uživatel v Notion viděl normální obsah a metadata nerušila čtení,
- staré stránky bez metadat se chovaly jako dnes (fallback na defaulty).

---

## 1. Metadata dokumentu — „Lovable meta" toggle

Na začátek Notion stránky (jako úplně první child block) zapisujeme **jeden toggle** s pevným nadpisem:

```
▸ ⚙️ Lovable metadata — needitovat ručně
   └─ code block, language: json
      { "v": 1, "doc": { ...DocumentMetadata... } }
```

- Toggle je sbalený → v Notion to nepřekáží.
- `code` block s `language: "json"` má strojově čitelný obsah a Notion ho při duplikaci přenese 1:1.
- Aplikace při importu hledá první toggle s prefixem `⚙️ Lovable metadata` a parsuje JSON. Pokud chybí → použije `DEFAULT_DOCUMENT_METADATA`.
- Při ukládání: pokud toggle existuje → vymažeme jeho `children` a zapíšeme nový code block; pokud ne → vytvoříme ho jako první child.

**Co půjde do JSONu:** kompletní `DocumentMetadata` (docCode, docName, coverImageUrl/Alt, všechny tři disclaimery, revision, footerVersion, copyright, showToc) + `settings` z `document_blocks` (cokoli aplikace dnes drží mimo bloky).

> Krátké skalární hodnoty (`docCode`, `docName`, `revision`, `footerVersion`) **navíc** zrcadlíme do Notion page properties, pokud v databázi existují (dnes už `notion-update` umí zapisovat `title` / `rich_text`). Tím zůstává Notion databáze použitelná pro řazení/filtraci. JSON je ale „zdroj pravdy".

---

## 2. Metadata bloku — neviditelný marker před každým blokem

Před každý logický blok (heading/text/table/image/image-table/pagebreak/callout) vložíme **jeden `paragraph` block**, který obsahuje jediný `rich_text` segment se:
- `annotations: { code: true, color: "gray" }`
- prefixem `LOV:` a kompaktním JSON, např.:
  ```
  LOV:{"id":"…uuid…","t":"image","tpl":"default","pic":"recycling","w":420}
  ```

Vlastnosti:
- Vizuálně malý šedý „inline code" řádek — v Notion je vidět, ale nepřekáží; uživatel pozná, že to patří aplikaci. Můžeme přidat toggle wrapper, ale jednoduchý paragraph je robustnější vůči duplikaci (Notion při duplikaci stránky kopíruje vše včetně toggle children).
- Aplikace při importu prochází children sekvenčně: když narazí na `paragraph` začínající `LOV:{`, načte JSON a aplikuje ho na **následující** Notion blok(y), které tvoří daný „aplikační" blok.
- Pokud marker chybí → blok se naimportuje s defaultními nastaveními (zpětná kompatibilita se starými stránkami).
- Pokud uživatel marker omylem smaže → blok přijde o piktogram/šablonu, ale obsah zůstane.

**Mapování typů na Notion bloky** (bez markeru se aplikace pokusí odhadnout):
| App blok      | Notion reprezentace                                    |
|---------------|--------------------------------------------------------|
| heading1–3    | `heading_1/2/3`                                        |
| heading4      | `heading_3` + marker `"t":"h4"`                        |
| text          | `paragraph` (HTML → rich_text už řešíme)               |
| table         | `table` (jak je dnes)                                  |
| image         | `image`                                                |
| image-table   | `image` + `table` (dvojice; marker drží párování)      |
| pagebreak     | `divider` + marker `"t":"pb"`                          |
| callout       | `callout` (alert/info/warning rozlišíme markerem)      |

**ID:** `id` v markeru je stabilní UUID z aplikace. Při duplikaci v Notion zůstane stejné → import detekuje duplicitu a pro nové stránce přegeneruje (kromě prvního výskytu) nebo prostě nahradí novými UUID s tím, že identita je dána pozicí, ne id.

---

## 3. Změny v kódu

### Frontend
- `src/components/BlockEditor/types.ts` — žádná změna typů, jen přidat helper `serializeBlockMeta(block)` / `parseBlockMeta(text)`.
- `src/components/DocumentMetadata/types.ts` — beze změny (už máme `DocumentMetadata`).
- `src/components/BlockEditor/importJson.ts` — rozšířit: pokud zdroj má `__lovMeta`, použít; jinak fallback.

### Edge funkce
- **`supabase/functions/notion-content/index.ts`** (čtení Notion → app):
  - Nový krok po `fetchBlockChildren`: oddělit první `⚙️ Lovable metadata` toggle → naparsovat `doc` JSON, vrátit klientovi spolu s bloky.
  - V `blocksToHtml` / konverzi: detekovat `LOV:` markery, k následujícímu bloku připojit `meta` a marker do výstupu nezahrnout.
  - Návratový tvar rozšířit o `{ documentMetadata, blocks }`.
- **`supabase/functions/notion-update/index.ts` + uložení obsahu** (zápis app → Notion):
  - Před zápisem children stránky:
    1. Najít/založit `⚙️ Lovable metadata` toggle, přepsat code block JSONem `DocumentMetadata`.
    2. Pro každý app blok vygenerovat `paragraph` marker `LOV:{...}` + samotné Notion bloky.
  - Krátké property zrcadlit přes stávající `textUpdates` (volitelně).

### Supabase
- Beze změn schématu. `document_blocks` zůstává jako lokální cache + autoritativní store pro nepřenesené uživatelské stavy (historie revizí, kdo upravil…), ale **doc + per-block meta** se vždy synchronizují do Notion.

---

## 4. Workflow round-tripu

1. **Save (app → Notion):** smažeme všechny children stránky → zapíšeme `[metaToggle, marker, block, marker, block, …]`.
2. **Load (Notion → app):** přečteme children → vyextrahujeme `doc` z toggle → zbytek projdeme sekvenčně, marker + následující blok(y) složíme do app bloků.
3. **Duplikace v Notion:** Notion zkopíruje toggle i markery → import funguje shodně. ID v markerech se případně přegenerují, obsah a nastavení zůstanou.
4. **Stránka bez metadat (legacy / cizí):** toggle chybí → `DEFAULT_DOCUMENT_METADATA`. Markery chybí → bloky s defaulty. Funguje jako dnes.

---

## 5. Otevřené otázky pro tebe

1. **Viditelnost markerů:** preferuješ (a) malý šedý inline-code paragraph před každým blokem (robustní, ale viditelný), nebo (b) zabalit každý blok do **toggle** s nadpisem `⚙️` a markerem uvnitř (čistší vzhled, ale toggle mění layout — např. nadpisy uvnitř toggle nejsou v Notion „skutečné" nadpisy a nezobrazí se v Notion TOC)?
2. **Zrcadlení do page properties:** mám u krátkých polí (`docCode`, `docName`, `revision`, `footerVersion`) udržovat i Notion property, pokud existuje? Pravidlo „JSON = zdroj pravdy, property = jen pro Notion views".
3. **Konflikty:** když se liší JSON v toggle a property v Notion (uživatel přepsal property ručně) — vyhrává JSON, nebo property?

Po odsouhlasení (a doplnění odpovědí 1–3) implementuji změny v `notion-content`, `notion-update` a importu/exportu na frontendu.
