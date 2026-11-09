# Knihovna „Piktogramy" (symboly) – plán po krocích

Stávající 4 piktogramy (`pictogram`, `[[pic:…]]`, PICTOGRAM_PATHS, emoji glyfy) zůstávají beze změny. Nová funkce používá v kódu i úložišti název **symbol** (`symbols`, `[[sym:…]]`), v UI „Piktogramy".

## Krok 1 – Databáze, úložiště, oprávnění
- Tabulka `public.symbols`: `id uuid`, `code text unique` (stabilní slug, nikdy se nemění), `name`, `file_path` (originál), `render_path` (zmenšená verze), `width_px`, `height_px`, `default_width_mm numeric default 20`, `archived bool default false`, `created_at`, `updated_at` (trigger), `updated_by`.
  - RLS: čtení pro všechny přihlášené (dokumenty se vykreslují všem), zápis jen admin nebo `can_pictograms`. GRANT pro authenticated + service_role.
- Bucket `symbols` (veřejný, stejně jako `notion-images` – obrázky musí jít do PDF a do Notion bez podpisu URL). Zápis přes politiky na `storage.objects` se stejnou podmínkou.
- `profiles.can_pictograms boolean not null default true` (stejně jako `can_folders`); úprava `admin-users`, `useAuth`, `UsersAdmin` (přepínač), `ProtectedRoute` (sekce `pictograms`), tlačítko v navigaci Library vedle Složky/Filtry.
- Počítání použití: funkce `symbol_usage(code)` nad `document_blocks.blocks` (hledání `"symbols"` / `[[sym:code` v JSONB jako text) → počet dokumentů.

## Krok 2 – Správa piktogramů (/library/pictograms)
- Mřížka náhledů, hledání podle názvu, přepínač „Zobrazit archivované".
- Hromadné nahrání PNG/SVG: název z názvu souboru, `code` = slug názvu (+ přípona při kolizi). V prohlížeči se z PNG vytvoří zmenšená verze (max 1200 px delší strana, PNG s průhledností) → `render_path`; originál se uloží také. SVG se uloží a pro PDF převede na PNG (react-pdf neumí obecné SVG).
- Upravit: název, výchozí šířka (mm). Nahradit soubor: dialog „Použito v N dokumentech", po potvrzení přepis souborů (cesta zůstává, přidá se `?v=updated_at` proti cache) → všechny dokumenty se změní, protože odkazují kódem.
- Archivovat / obnovit; trvalé smazání jen při 0 použitích.
- Úvodních 16 PNG naseeduji v tomto kroku z příloh.

## Krok 3 – Datový model v dokumentu + serializace
- Sdílený typ `SymbolRef = { code: string; w: number /* mm */; pos: "left" | "right" | "center" | "top" }`.
- Textový blok: nové volitelné pole `content.symbols?: SymbolRef[]` – piktogramy se vážou k bloku (ne inline uvnitř HTML), zobrazí se v pořadí. Jednodušší a robustní vůči formátovacímu editoru; odpovídá chování obrázků.
- Buňka tabulky: token(y) na začátku řetězce buňky, za případným `[[pic:]]` a před `[[html]]`: `[[pic:info]][[sym:screw-cz|w=12|pos=left]][[html]]…`. Pozice v buňce: `left` / `top` / `center` (samostatně).
- Notion token: `[[sym:code|w=20|pos=left]]`. Textový blok: tokeny na samostatném prvním odstavci bloku. Tolerantní parser: povolí mezery, chybějící/neznámé parametry (→ výchozí z knihovny), velká písmena, `｜`/`|`, rozbitý konec; při nenaparsování token nechá jako text (nic se neztratí).
- Pomocný modul `symbolTokens.ts` (parse/format/strip) + použití v `serialize.ts`, `importJson.ts`, `cellFormatting.ts`, `searchBlocks` (ignorovat), `notion-content` (stejný parser v `_shared`).
- Fingerprint stránkování: přidá `code`, `w`, `pos` (bez URL) a rozměry obrázku z knihovny.
- Testy: round-trip text/buňka, koexistence s `[[pic:]]`, `[[html]]` a merges, poškozené tokeny, neznámý kód.

## Krok 4 – Výběr a editor
- Sdílená komponenta `SymbolPicker` (dialog: mřížka, hledání, „Naposledy použité" nahoře – localStorage, archivované skryté).
- Textový blok: tlačítko „Vložit piktogram" v liště; pod lištou pás vložených piktogramů s ovládáním šířky (mm), pozice (Vlevo/Vpravo/Na střed) a odebrání; náhled v editoru obtéká text (CSS float).
- Buňky: tlačítko v `TableCellEditor` + kontextové menu buňky; buňka zobrazí miniaturu s volbou pozice a šířky.
- Hook `useSymbols()` – načte knihovnu jednou a dává mapu `code → {url, poměr stran, archived}`; neznámý kód = šedý zástupný rámeček „Neznámý piktogram: code".

## Krok 5 – PDF
- Před generováním se symboly inlinují jednou (stejně jako obrázky, `render_path`).
- Text: `left/right` → znovupoužití `imageWrap.ts` (šířka v mm místo 50 %), nerozdělitelný řádek + zbytek plnou šířkou; více piktogramů vlevo/vpravo se skládá pod sebe v jednom sloupci; `center` → samostatně nad textem.
- Buňky: `left` = řádek ikona+text, `top` = ikona nad textem, `center` = jen ikona na střed; šířka omezena šířkou sloupce. Funguje i v rowspan skupinách.
- Měření stránkování beze změny principu; nové testy s reálným rendererem (překryvy, dělení).
- Marker `[paginate] v11`.

## Krok 6 – Dokončení
- Verze MINOR + české odrážky v logu změn, pravidla v AGENTS.md (oddělení symbolů od piktogramů, formát tokenu, reference kódem).
- Živé ověření: nahrání, vložení do textu a buňky, PDF, export a znovunačtení z Notion.

## Rizika
- Překladač (LLM) může poškodit token → tolerantní parser, při selhání zůstane text viditelný; doporučuji v Make promptu uvést „neměň `[[…]]`".
- Velké PNG (6600 px) → zmenšování v prohlížeči může trvat; zobrazím průběh.
- Odhad obtékání v PDF je přibližný (jako dnes u obrázků).
- Uživatel bez `can_pictograms` piktogramy vkládat může, spravovat ne.

## K rozhodnutí
1. Text: piktogramy jako seznam u bloku (navrhuji) vs. inline na libovolném místě v textu (výrazně složitější, horší obtékání v PDF)?
2. Bucket veřejný (navrhuji, kvůli Notion/PDF) – OK?
3. Mohou vkládat piktogramy všichni s přístupem k dokumentům (navrhuji), nebo jen s `can_pictograms`?
4. Do Notion posílat jen token, nebo token + obrázek (aby byl v Notion vidět)? Navrhuji jen token.
5. Výchozí šířka 20 mm a max. zmenšení 1200 px – OK?
