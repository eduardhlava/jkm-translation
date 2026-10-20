import { Document, Page, Text, View, Image, Link, StyleSheet, Font, Svg, Path } from "@react-pdf/renderer";
import { Fragment, cloneElement } from "react";
import { cellTextToHtml } from "@/components/BlockEditor/cellFormatting";
import { parseCellPictogram, type Block, type Pictogram } from "@/components/BlockEditor/types";
import notoRegular from "@/assets/fonts/NotoSans-Regular.ttf?url";
import notoBold from "@/assets/fonts/NotoSans-Bold.ttf?url";
import notoItalic from "@/assets/fonts/NotoSans-Italic.ttf?url";
import notoBoldItalic from "@/assets/fonts/NotoSans-BoldItalic.ttf?url";
import { PICTOGRAM_PATHS } from "@/components/BlockEditor/pictogramPaths";
import { HALF_COLUMN_PT, SIDE_TEXT_WIDTH_PT, WRAP_GAP_PT, imagePositionOf, sideImageHeight, splitTextForWrap, wrapsNextText } from "./imageWrap";
import { DOCUMENT_LANGUAGES, mergeMetadata, type DocumentMetadata } from "@/components/DocumentMetadata/types";

const NOTO_FACES = [
  { src: notoRegular, fontWeight: "normal" as const },
  { src: notoBold, fontWeight: "bold" as const },
  { src: notoItalic, fontStyle: "italic" as const },
  { src: notoBoldItalic, fontWeight: "bold" as const, fontStyle: "italic" as const },
];

Font.register({ family: "NotoSans", fonts: NOTO_FACES });

// Safety net: any font-family that can sneak in from pasted HTML (Word, Outlook,
// Notion) or from embedded SVG artwork (e.g. font-family="Arial, sans-serif")
// would otherwise crash react-pdf with "Font family not registered".
// We alias the most common CSS font stacks onto NotoSans.
const FONT_ALIASES = [
  "Arial",
  "Arial, sans-serif",
  "Arial, Helvetica, sans-serif",
  "Helvetica",
  "Helvetica, Arial, sans-serif",
  "Helvetica Neue",
  "sans-serif",
  "serif",
  "Times New Roman",
  "Times New Roman, serif",
  "Georgia",
  "Verdana",
  "Tahoma",
  "Segoe UI",
  "Calibri",
  "Roboto",
  "Inter",
  "Courier New",
  "monospace",
  "inherit",
  "initial",
];
for (const family of FONT_ALIASES) {
  try {
    Font.register({ family, fonts: NOTO_FACES });
  } catch {
    /* ignore duplicate/invalid registrations */
  }
}
Font.registerHyphenationCallback((word) => [word]);


// Regression: an oversized unbreakable image makes react-pdf shrink siblings,
// squeezing text lines and overlapping images. Reserve room for margins/caption
// within the 732pt A4 body, and never flex-shrink the surrounding block containers.
const MAX_IMAGE_HEIGHT_PT = 640;


// ---------- Styles ----------
const styles = StyleSheet.create({
  page: {
    paddingTop: 50,
    paddingBottom: 60,
    paddingHorizontal: 50,
    fontSize: 11,
    fontFamily: "NotoSans",
    color: "#111827",
  },
  docTitle: { fontSize: 20, lineHeight: 1.2, fontFamily: "NotoSans", fontWeight: "bold", marginBottom: 14 },
  h1Wrap: { width: "100%", marginTop: 28, marginBottom: 8, flexShrink: 0 },
  h2Wrap: { width: "100%", marginTop: 24, marginBottom: 6, flexShrink: 0 },
  h3Wrap: { width: "100%", marginTop: 20, marginBottom: 4, flexShrink: 0 },
  h4Wrap: { width: "100%", marginTop: 18, marginBottom: 3, flexShrink: 0 },
  spacer: { height: 31.5, flexShrink: 0 },
  h1: { fontSize: 16, lineHeight: 1.25, fontFamily: "NotoSans", fontWeight: "bold" },
  h2: { fontSize: 13, lineHeight: 1.25, fontFamily: "NotoSans", fontWeight: "bold" },
  h3: { fontSize: 11.5, lineHeight: 1.25, fontFamily: "NotoSans", fontWeight: "bold" },
  h4: { fontSize: 10.5, lineHeight: 1.25, fontFamily: "NotoSans", fontWeight: "bold" },
  textBlock: { width: "100%", flexShrink: 0 },
  paragraphWrap: { width: "100%", marginBottom: 6, flexShrink: 0 },
  p: { fontSize: 10.5, lineHeight: 1.5 },
  li: { flexDirection: "row", marginBottom: 2, fontSize: 10.5, lineHeight: 1.5, flexShrink: 0 },
  liBullet: { width: 14 },
  liContent: { flex: 1 },
  imageBlock: { width: "100%", marginVertical: 10, alignItems: "center", flexShrink: 0 },
  image: { objectFit: "contain" },
  caption: { fontSize: 9, color: "#6b7280", textAlign: "center", marginTop: 2 },
  callout: {
    flexShrink: 0,
    flexDirection: "row",
    gap: 8,
    padding: 10,
    marginVertical: 6,
    borderRadius: 4,
    borderLeftWidth: 4,
  },
  calloutIcon: { fontSize: 14 },
  calloutText: { flex: 1 },
  table: { borderWidth: 1, borderColor: "#d1d5db", marginVertical: 6, flexShrink: 0 },
  tr: { flexDirection: "row", flexShrink: 0 },
  td: { flex: 1, minWidth: 0, padding: 2.8, borderRightWidth: 1, borderBottomWidth: 1, borderColor: "#d1d5db", fontSize: 9 },
  cellIcon: { width: 14, height: 14, flexShrink: 0 },
  cellText: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
  th: { backgroundColor: "#f3f4f6", fontFamily: "NotoSans", fontWeight: "bold" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 50,
    right: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 9,
    color: "#6b7280",
  },
  footerLeft: { flex: 1, textAlign: "left" },
  footerRight: { textAlign: "right" },
  tocTitle: { fontSize: 16, fontFamily: "NotoSans", fontWeight: "bold", marginBottom: 10 },
  tocRow: { flexDirection: "row", marginBottom: 3, fontSize: 11 },
  tocLeft: { flex: 1 },
  tocPage: { width: 30, textAlign: "right" },
  tocLink: { color: "#111827", textDecoration: "none" },
  // Cover page
  coverPage: {
    paddingTop: 40,
    paddingBottom: 90,
    paddingHorizontal: 50,
    fontFamily: "NotoSans",
    color: "#111827",
  },
  coverLogoWrap: { alignItems: "center", marginBottom: 113 },
  coverLogo: { width: 140, objectFit: "contain" },
  coverSubtitle: { textAlign: "center", fontSize: 11, marginBottom: 16, letterSpacing: 1.2, color: "#4b5563" },
  coverTitle: {
    textAlign: "center",
    fontSize: 20,
    lineHeight: 1.25,
    fontFamily: "NotoSans",
    fontWeight: "bold",
    marginBottom: 14,
  },
  coverImageWrap: { alignItems: "center", marginVertical: 18 },
  coverImage: { maxHeight: 280, width: 260, objectFit: "contain" },
  coverLanguage: {
    textAlign: "center",
    fontSize: 12,
    fontFamily: "NotoSans",
    fontWeight: "bold",
    marginTop: 10,
    letterSpacing: 0.5,
  },
  coverManufacturer: {
    position: "absolute",
    left: 50,
    right: 50,
    bottom: 60,
    flexDirection: "row",
    fontSize: 10,
    lineHeight: 1.45,
  },
  coverColLeft: { flex: 1 },
  coverColMid: { flex: 1, textAlign: "center", paddingTop: 14 },
  coverColRight: { flex: 1, textAlign: "right", paddingTop: 14 },
  // Disclaimer boxes
  disclaimerBox: {
    borderWidth: 1,
    borderColor: "#111827",
    marginBottom: 18,
  },
  disclaimerHeader: {
    borderBottomWidth: 1,
    borderBottomColor: "#111827",
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#ffffff",
  },
  disclaimerHeaderText: {
    textAlign: "center",
    fontFamily: "NotoSans",
    fontWeight: "bold",
    fontSize: 12,
  },
  disclaimerBody: { padding: 10 },
  disclaimerLine: { fontSize: 11, lineHeight: 1.45, marginBottom: 4 },
});

const calloutCfg = {
  alert:   { icon: "!", border: "#dc2626", bg: "#fef2f2", color: "#991b1b" },
  info:    { icon: "i", border: "#2563eb", bg: "#eff6ff", color: "#1e3a8a" },
  warning: { icon: "!", border: "#d97706", bg: "#fffbeb", color: "#92400e" },
} as const;

// ---------- HTML → inline runs ----------
type Run = { text: string; bold?: boolean; italic?: boolean; underline?: boolean; href?: string; bg?: string; sup?: boolean; sub?: boolean };

function parseInline(html: string): Run[][] {
  if (!html) return [[]];
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstChild as HTMLElement;
  const paragraphs: Run[][] = [];
  let current: Run[] = [];

  const flushPara = () => {
    paragraphs.push(current);
    current = [];
  };

  const readBg = (el: HTMLElement): string | undefined => {
    const style = el.getAttribute("style") || "";
    const m = style.match(/background-color\s*:\s*([^;]+)/i);
    if (!m) return undefined;
    const v = m[1].trim();
    if (!v || v === "transparent" || v.toLowerCase() === "initial" || v.toLowerCase() === "inherit") return undefined;
    return v;
  };

  const walk = (node: Node, ann: Omit<Run, "text">) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent ?? "";
      if (t) current.push({ ...ann, text: t });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toUpperCase();
    if (tag === "BR") { current.push({ text: "\n" }); return; }
    if (tag === "P" || tag === "DIV") {
      if (current.length) flushPara();
      const bg = readBg(el);
      const next = bg ? { ...ann, bg } : ann;
      el.childNodes.forEach((c) => walk(c, next));
      flushPara();
      return;
    }
    const next = { ...ann };
    if (tag === "STRONG" || tag === "B") next.bold = true;
    if (tag === "EM" || tag === "I") next.italic = true;
    if (tag === "U") next.underline = true;
    if (tag === "SUP") { next.sup = true; next.sub = false; }
    if (tag === "SUB") { next.sub = true; next.sup = false; }
    const st = (el.getAttribute("style") || "").toLowerCase();
    if (/font-weight\s*:\s*(bold|[6-9]00)/.test(st)) next.bold = true;
    if (/font-style\s*:\s*italic/.test(st)) next.italic = true;
    if (/vertical-align\s*:\s*super/.test(st)) next.sup = true;
    if (/vertical-align\s*:\s*sub/.test(st)) next.sub = true;
    if (tag === "A") next.href = el.getAttribute("href") ?? undefined;
    const bg = readBg(el);
    if (bg) next.bg = bg;
    el.childNodes.forEach((c) => walk(c, next));
  };

  root.childNodes.forEach((c) => walk(c, {}));
  if (current.length) flushPara();
  return paragraphs.length ? paragraphs : [[]];
}

function fontFamilyFor(r: Run): string {
  return "NotoSans";
}

function fontStyleFor(r: Run): Record<string, string> {
  return {
    fontFamily: fontFamilyFor(r),
    fontWeight: r.bold ? "bold" : "normal",
    fontStyle: r.italic ? "italic" : "normal",
  };
}

function RunsText({ runs }: { runs: Run[] }) {
  const hasInlineStyles = runs.some((r) => r.bold || r.italic || r.underline || r.href || r.bg || r.sup || r.sub);
  if (!hasInlineStyles) return <>{runs.map((r) => r.text).join("")}</>;

  return (
    <>
      {runs.map((r, i) => {
        const style: any = fontStyleFor(r);
        if (r.underline || r.href) style.textDecoration = "underline";
        if (r.href) style.color = "#2563eb";
        if (r.bg) style.backgroundColor = r.bg;
        if (r.sup || r.sub) {
          style.fontSize = 7;
          style.verticalAlign = r.sup ? "super" : "sub";
        }
        if (r.href) {
          return (
            <Link key={i} src={r.href} style={style}>
              {r.text}
            </Link>
          );
        }
        return (
          <Text key={i} style={style}>
            {r.text}
          </Text>
        );
      })}
    </>
  );
}

// ---------- Heading collector ----------
export type HeadingEntry = { id: string; level: 1 | 2 | 3; text: string };
export type PageMap = Map<string, number>;

export function collectHeadings(blocks: Block[]): HeadingEntry[] {
  const out: HeadingEntry[] = [];
  [...blocks].sort((a, b) => a.order - b.order).forEach((b) => {
    if (b.content?.unlisted) return;
    if (b.type === "heading1") out.push({ id: b.id, level: 1, text: b.content?.text ?? "" });
    else if (b.type === "heading2") out.push({ id: b.id, level: 2, text: b.content?.text ?? "" });
    else if (b.type === "heading3") out.push({ id: b.id, level: 3, text: b.content?.text ?? "" });
  });
  return out;
}

// ---------- Block renderers ----------
export interface MeasureContext {
  keepWithNextPt: number;
  headingPages: Map<string, number>;
  prevEndPages: Map<string, number>;
  // Pro každý nadpis řetězce H2/H3/H4: stránka, kde skutečně ZAČÍNÁ první
  // nezalomitelná jednotka prvního obsahového bloku za řetězcem (obrázek,
  // callout, první řádek tabulky, první odstavec textu…). Když nextStart >
  // headingPage, blok odskočil na další stránku a nadpis zůstal osiřelý.
  nextStartPages: Map<string, number>;
  // Pravidlo pro tabulky: stránka prvního a posledního řádku tabulky
  // U image-table tableStartPages měří obrázek pro přesun celého bloku,
  // tablePartStartPages měří první řádek pro detekci dělení samotné tabulky.
  tableStartPages: Map<string, number>;
  tablePartStartPages: Map<string, number>;
  tableEndPages: Map<string, number>;
}

/** Neviditelná značka zaznamenávající číslo stránky. */
function PageMarker({ onPage }: { onPage: (pageNumber: number) => void }) {
  return (
    <Text
      style={{ height: 0, fontSize: 0 }}
      render={({ pageNumber }) => {
        onPage(pageNumber);
        return "";
      }}
    />
  );
}

/** Neviditelná značka zaznamenávající stránku začátku bloku pro dané nadpisy. */
function StartMarker({ ids, measure }: { ids: string[]; measure: MeasureContext }) {
  return (
    <Text
      style={{ height: 0, fontSize: 0 }}
      render={({ pageNumber }) => {
        for (const id of ids) measure.nextStartPages.set(id, pageNumber);
        return "";
      }}
    />
  );
}

function Heading({ block, level, collector, number, measure }: { block: Block; level: 1 | 2 | 3 | 4; collector?: PageMap; number?: string; measure?: MeasureContext }) {
  const styleMap = { 1: styles.h1, 2: styles.h2, 3: styles.h3, 4: styles.h4 } as const;
  const wrapStyleMap = { 1: styles.h1Wrap, 2: styles.h2Wrap, 3: styles.h3Wrap, 4: styles.h4Wrap } as const;
  const text = block.content?.text ?? "";
  const prefixed = number ? `${number}  ${text}` : text;
  const keepWithNext = measure && level >= 2;
  const inner = (
    <View wrap={false} style={wrapStyleMap[level]}>
      <Text style={styleMap[level]}>{prefixed}</Text>
      {collector && level <= 3 && (
        <Text
          style={{ height: 0, fontSize: 0 }}
          render={({ pageNumber }) => {
            collector.set(block.id, pageNumber);
            return "";
          }}
        />
      )}
      {keepWithNext && (
        <Text
          style={{ height: 0, fontSize: 0 }}
          render={({ pageNumber }) => {
            measure.headingPages.set(block.id, pageNumber);
            return "";
          }}
        />
      )}
    </View>
  );
  if (!keepWithNext) return inner;
  // minPresenceAhead se v naší struktuře (sourozenci v jedné <Page>) spolehlivě
  // neuplatní, proto měříme sondou: nadpis + neviditelná sonda vysoká
  // keepWithNextPt s kompenzačním záporným marginem v nezalomitelném
  // kontejneru. Když se pod nadpis nevejde keepWithNextPt prostoru, react-pdf
  // přesune celý kontejner na další stránku a my porušení poznáme podle
  // rozdílu stránek (headingPage > prevEndPage).
  // Regression: negative margin MUST be on the OUTER container. Putting it
  // on the probe shrinks the container's measured height to the heading alone,
  // so react-pdf 4.5.1 never sees the reserved space during its page-fit check.
  // The outer margin compensates only following content positions, not fit height.
  return (
    <View wrap={false} style={{ marginBottom: -measure.keepWithNextPt, flexShrink: 0 }}>
      {inner}
      <View style={{ height: measure.keepWithNextPt }} />
    </View>
  );
}


const BASE_FONT_SIZE = 11;

function parseStyleAttr(el: Element): { textAlign?: "left" | "center" | "right" | "justify"; fontSize?: number } {
  const out: { textAlign?: any; fontSize?: number } = {};
  const raw = (el as HTMLElement).getAttribute("style") || "";
  if (!raw) return out;
  for (const decl of raw.split(";")) {
    const idx = decl.indexOf(":");
    if (idx < 0) continue;
    const key = decl.slice(0, idx).trim().toLowerCase();
    const val = decl.slice(idx + 1).trim();
    if (!val) continue;
    if (key === "text-align" && /^(left|center|right|justify)$/i.test(val)) {
      out.textAlign = val.toLowerCase() as any;
    } else if (key === "font-size") {
      const m = val.match(/^([\d.]+)(em|rem|px|%)$/i);
      if (m) {
        const n = parseFloat(m[1]);
        const unit = m[2].toLowerCase();
        if (unit === "em" || unit === "rem") out.fontSize = Math.round(BASE_FONT_SIZE * n);
        else if (unit === "%") out.fontSize = Math.round(BASE_FONT_SIZE * (n / 100));
        else if (unit === "px") out.fontSize = Math.round(n * 0.75); // px → pt approx
      }
    }
  }
  return out;
}

function PictogramSvg({ kind, size = 26 }: { kind: Pictogram; size?: number }) {
  const d = PICTOGRAM_PATHS[kind as keyof typeof PICTOGRAM_PATHS];
  if (!d) return null;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={d} fill="#333333" fillRule="evenodd" />
    </Svg>
  );
}


function TextBlock({ block, startMarker }: { block: Block; startMarker?: JSX.Element }) {
  const defaultPStyle = { ...styles.p } as any;
  const defaultLiStyle = { ...styles.li } as any;

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${block.content?.html ?? ""}</div>`, "text/html");
  const root = doc.body.firstChild as HTMLElement;
  const nodes: JSX.Element[] = [];
  let key = 0;

  const renderInlineNode = (el: Element): Run[] => {
    const html = (el as HTMLElement).innerHTML;
    const paras = parseInline(html);
    return paras.flat();
  };

  const renderRootChildren = (parent: HTMLElement) => {
    // Consecutive inline nodes (text, <b>, <i>, <sup>, <span>…) belong to the
    // same paragraph — buffer them and flush as one <Text> line.
    let inlineBuf = "";
    const flushInline = () => {
      if (!inlineBuf) return;
      const paras = parseInline(inlineBuf);
      inlineBuf = "";
      paras.forEach((runs) => {
        if (!runs.length || !runs.some((r) => r.text.trim())) return;
        nodes.push(<View key={key++} style={styles.paragraphWrap}><Text style={defaultPStyle}><RunsText runs={runs} /></Text></View>);
      });
    };
    parent.childNodes.forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) {
        inlineBuf += (n.textContent ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return;
      }
      if (n.nodeType !== Node.ELEMENT_NODE) return;
      const el = n as HTMLElement;
      const tag = el.tagName.toUpperCase();
      if (tag === "UL" || tag === "OL") {
        flushInline();
        const items = Array.from(el.children).filter((c) => c.tagName.toUpperCase() === "LI");
        const listStart = parseInt(el.getAttribute("start") ?? "1", 10) || 1;
        items.forEach((li, i) => {
          const runs = renderInlineNode(li);
          const s = parseStyleAttr(li);
          const liStyle = { ...defaultLiStyle, ...(s.fontSize ? { fontSize: s.fontSize } : {}) };
          const contentStyle = { ...styles.liContent, ...(s.textAlign ? { textAlign: s.textAlign } : {}), ...(s.fontSize ? { fontSize: s.fontSize } : {}) } as any;
          nodes.push(
            <View key={key++} style={liStyle}>
              <Text style={styles.liBullet}>{tag === "OL" ? `${listStart + i}.` : "•"}</Text>
              <Text style={contentStyle}><RunsText runs={runs} /></Text>
            </View>
          );
        });
        return;
      }
      if (tag === "P" || tag === "DIV") {
        flushInline();
        const runs = parseInline(el.innerHTML).flat();
        if (!runs.length) return;
        const s = parseStyleAttr(el);
        const pStyle = { ...defaultPStyle, ...(s.textAlign ? { textAlign: s.textAlign } : {}), ...(s.fontSize ? { fontSize: s.fontSize } : {}) } as any;
        nodes.push(<View key={key++} style={styles.paragraphWrap}><Text style={pStyle}><RunsText runs={runs} /></Text></View>);
        return;
      }
      // Inline element: keep in the current paragraph
      inlineBuf += el.outerHTML;
    });
    flushInline();
  };

  let body: JSX.Element;
  // Značku začátku vložíme DO prvního odstavce (i u zalomitelného piktogramového textu),
  // aby zaznamenala stránku, kde text skutečně začíná.
  const withMarker = (children: (JSX.Element | null)[]): (JSX.Element | null)[] => {
    if (!startMarker) return children;
    const idx = children.findIndex((c) => c !== null);
    if (idx < 0) return children;
    const first = children[idx]!;
    const clone = cloneElement(first, { key: first.key ?? "first" }, startMarker, first.props.children);
    return [...children.slice(0, idx), clone, ...children.slice(idx + 1)];
  };
  if (!root || root.children.length === 0) {
    const paragraphs = parseInline(block.content?.html ?? "");
    body = (
      <View style={styles.textBlock}>
        {withMarker(paragraphs.map((runs, i) =>
          runs.length ? <View key={i} style={styles.paragraphWrap}><Text style={defaultPStyle}><RunsText runs={runs} /></Text></View> : null
        ))}
      </View>
    );
  } else {
    renderRootChildren(root);
    body = <View style={styles.textBlock}>{withMarker(nodes)}</View>;
  }

  const pictogram = block.content?.pictogram;
  if (pictogram && pictogram !== "none") {
    return (
      <View style={{ position: "relative", marginVertical: 4, flexShrink: 0 }}>
        <View style={{ position: "absolute", left: -36, top: 2, width: 30, alignItems: "center" }}>
          <PictogramSvg kind={pictogram} size={26} />
        </View>
        {body}
      </View>
    );
  }
  return body;
}

function ImageBlock({ block, captionOverride, startMarker, measure, measureStartId, inColumn }: { block: Block; captionOverride?: string; startMarker?: JSX.Element; measure?: MeasureContext; measureStartId?: string; inColumn?: boolean }) {
  const url = block.content?.url;
  const alt = block.content?.alt;
  if (!url) return null;
  const caption = captionOverride !== undefined ? captionOverride : alt;
  // "half" → 50 % of the content width (centered) unless placed in a wrap column.
  const half = !inColumn && block.content?.size === "half";
  return (
    <View wrap={false} style={styles.imageBlock}>
      {startMarker}
      {measure && measureStartId && (
        <PageMarker onPage={(p) => measure.tableStartPages.set(measureStartId, p)} />
      )}
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <Image src={url} style={[styles.image, { width: half ? "49%" : "98%", maxHeight: MAX_IMAGE_HEIGHT_PT }]} />
      {caption ? <Text style={[styles.caption, half ? { width: "50%" } : {}]}>{caption}</Text> : null}
    </View>
  );
}

function TableBlock({ block, startMarker, measure, measureStartId, measurePartStartId, measureEndId }: { block: Block; startMarker?: JSX.Element; measure?: MeasureContext; measureStartId?: string; measurePartStartId?: string; measureEndId?: string }) {
  const rows: string[][] = block.content?.rows ?? [];
  const headerRow = !!block.content?.headerRow;
  const colWidths: number[] | undefined = block.content?.colWidths;
  const rowColors: Array<string | null> = block.content?.rowColors ?? [];
  if (rows.length === 0) return null;
  const cols = rows[0]?.length ?? 0;
  const hasWidths = !!colWidths && colWidths.length === cols && cols > 0;
  const lastRi = rows.length - 1;
  return (
    <View style={styles.table}>
      {rows.map((row, ri) => {
        const rowBg = rowColors[ri] ?? null;
        return (
          <View key={ri} style={[styles.tr, rowBg ? { backgroundColor: rowBg } : {}] as any} wrap={false}>
            {ri === 0 ? startMarker : null}
            {measure && measureStartId && ri === 0 && (
              <PageMarker onPage={(p) => measure.tableStartPages.set(measureStartId, p)} />
            )}
            {measure && measurePartStartId && ri === 0 && (
              <PageMarker onPage={(p) => measure.tablePartStartPages.set(measurePartStartId, p)} />
            )}
            {measure && measureEndId && ri === lastRi && (
              <PageMarker onPage={(p) => measure.tableEndPages.set(measureEndId, p)} />
            )}
            {row.map((cell, ci) => {
              const wStyle = hasWidths && colWidths
                ? { width: `${colWidths[ci]}%`, flexGrow: 0, flexShrink: 0, flexBasis: `${colWidths[ci]}%` }
                : { flex: 1 };
              const isHeader = headerRow && ri === 0 && !rowBg;
              const { pictogram: cellPic, text: cellText } = parseCellPictogram(cell ?? "");
              const paragraphs = parseInline(cellTextToHtml(cellText));
              const formattedText = paragraphs.map((runs, i) => <Fragment key={i}>{i > 0 ? "\n" : ""}<RunsText runs={headerRow && ri === 0 ? runs.map((run) => ({ ...run, bold: true })) : runs} /></Fragment>);
              const cellStyle = [styles.td, wStyle, isHeader ? styles.th : {}, headerRow && ri === 0 ? { fontFamily: "NotoSans", fontWeight: "bold" } : {}] as any;
              if (cellPic !== "none") {
                return (
                  <View key={ci} style={[cellStyle, { flexDirection: "row", alignItems: "center", gap: 4 }] as any}>
                    <View style={styles.cellIcon}><PictogramSvg kind={cellPic} size={14} /></View>
                    {cellText ? <Text style={styles.cellText}>{formattedText}</Text> : null}
                  </View>
                );
              }
              return (
                <Text key={ci} style={cellStyle}>
                  {formattedText}
                </Text>
              );
            })}

          </View>
        );
      })}
    </View>
  );
}

function CalloutBlock({ block, startMarker }: { block: Block; startMarker?: JSX.Element }) {
  const cfg = calloutCfg[block.type as keyof typeof calloutCfg];
  return (
    <View
      style={[
        styles.callout,
        { borderLeftColor: cfg.border, backgroundColor: cfg.bg, color: cfg.color },
      ] as any}
      wrap={false}
    >
      {startMarker}
      <Text style={styles.calloutIcon}>{cfg.icon}</Text>
      <Text style={styles.calloutText}>{block.content?.text ?? ""}</Text>
    </View>
  );
}

function withPictogram(block: Block, node: JSX.Element) {
  const pictogram = block.content?.pictogram;
  if (!pictogram || pictogram === "none") return node;
  return (
    <View style={{ position: "relative", marginVertical: 4, flexShrink: 0 }}>
      <View style={{ position: "absolute", left: -36, top: 2, width: 30, alignItems: "center" }}>
        <PictogramSvg kind={pictogram} size={26} />
      </View>
      {node}
    </View>
  );
}

function BlockNode({ block, collector, number, imageCaption, measure, measureNextFor }: { block: Block; collector?: PageMap; number?: string; imageCaption?: string; measure?: MeasureContext; measureNextFor?: string[] }) {
  // Značka začátku první nezalomitelné jednotky bloku – pro detekci osiřelých
  // nadpisů před nezalomitelným blokem (obrázek, callout, tabulka…).
  const startMarker = measure && measureNextFor && measureNextFor.length > 0
    ? <StartMarker ids={measureNextFor} measure={measure} />
    : undefined;
  switch (block.type) {
    case "heading1": return <Heading block={block} level={1} collector={collector} number={number} />;
    case "heading2": return <Heading block={block} level={2} collector={collector} number={number} measure={measure} />;
    case "heading3": return <Heading block={block} level={3} collector={collector} number={number} measure={measure} />;
    case "heading4": return <Heading block={block} level={4} number={number} measure={measure} />;
    case "text":     return <TextBlock block={block} startMarker={startMarker} />;
    case "image":    return withPictogram(block, <ImageBlock block={block} captionOverride={imageCaption} startMarker={startMarker} />);
    case "table":    return withPictogram(block, <TableBlock block={block} startMarker={startMarker} measure={measure} measureStartId={block.id} measureEndId={block.id} />);
    case "image-table": return withPictogram(block, (
      <>
        <ImageBlock block={{ ...block, type: "image", content: block.content?.image ?? {} } as Block} captionOverride={imageCaption} startMarker={startMarker} measure={measure} measureStartId={block.id} />
        {/* Caption stays inside ImageBlock; only the table moves to a new page. */}
        {block.content?.autoTableBreak === true ? <View break /> : null}
        <TableBlock block={{ ...block, type: "table", content: block.content?.table ?? { headerRow: true, rows: [] } } as Block} measure={measure} measurePartStartId={block.id} measureEndId={block.id} />
      </>
    ));
    case "alert":
    case "info":
    case "warning":  return <CalloutBlock block={block} startMarker={startMarker} />;
    case "pagebreak": return <View break />;
    case "spacer": return startMarker
      ? <View wrap={false}>{startMarker}<View style={styles.spacer} /></View>
      : <View wrap={false} style={styles.spacer} />;
    default: return null;

  }
}


/**
 * Half-width left/right image + the directly following text block: an
 * unbreakable row (image column, gap, side text) followed by the rest of the
 * text at full width. The consumed text block is not rendered again.
 */
function WrappedImageText({ image, text, caption, measure, measureNextFor }: { image: Block; text: Block; caption?: string; measure?: MeasureContext; measureNextFor?: string[] }) {
  const startMarker = measure && measureNextFor && measureNextFor.length > 0
    ? <StartMarker ids={measureNextFor} measure={measure} />
    : undefined;
  const right = imagePositionOf(image.content) === "right";
  const sideH = sideImageHeight(image.content?.url, caption, MAX_IMAGE_HEIGHT_PT);
  const { side, rest } = splitTextForWrap(text.content?.html ?? "", sideH);
  const plain = (html: string): Block => ({ ...text, content: { ...text.content, html, pictogram: "none" } });
  const row = (
    <View style={{ flexShrink: 0 }}>
      <View wrap={false} style={{ flexDirection: right ? "row-reverse" : "row", alignItems: "flex-start", flexShrink: 0 }}>
        <View style={{ width: HALF_COLUMN_PT, flexShrink: 0 }}>
          <ImageBlock block={image} captionOverride={caption} startMarker={startMarker} inColumn />
        </View>
        <View style={{ width: WRAP_GAP_PT, flexShrink: 0 }} />
        <View style={{ width: SIDE_TEXT_WIDTH_PT, paddingTop: 10, flexShrink: 0 }}>
          {side ? <TextBlock block={plain(side)} /> : null}
        </View>
      </View>
      {rest ? <TextBlock block={plain(rest)} /> : null}
    </View>
  );
  const pic = image.content?.pictogram && image.content.pictogram !== "none" ? image : text;
  return withPictogram(pic, row);
}

// ---------- TOC ----------
function Toc({ entries, pageMap, numbers }: { entries: HeadingEntry[]; pageMap: PageMap; numbers?: Map<string, string> }) {
  if (entries.length === 0) return null;
  return (
    <View>
      <Text style={styles.tocTitle}>Obsah</Text>
      {entries.map((e) => {
        const indent = (e.level - 1) * 14;
        const pn = pageMap.get(e.id);
        const num = numbers?.get(e.id);
        const label = num ? `${num}  ${e.text || "—"}` : (e.text || "—");
        return (
          <View key={e.id} style={styles.tocRow} wrap={false}>
            <Text style={[styles.tocLeft, { paddingLeft: indent }] as any}>{label}</Text>
            <Text style={styles.tocPage}>{pn ?? ""}</Text>
          </View>
        );
      })}
    </View>
  );
}


// ---------- Footer ----------
function Footer({ footerVersion }: { footerVersion?: string }) {
  return (
    <View fixed style={styles.footer}>
      <Text style={styles.footerLeft}>{footerVersion ?? ""}</Text>
      <Text
        style={styles.footerRight}
        render={({ pageNumber, totalPages }) => `Strana ${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}

// ---------- Cover Page ----------
function CoverPage({ metadata, logoDataUrl, footerVersion }: { metadata: DocumentMetadata; logoDataUrl?: string; footerVersion?: string }) {
  return (
    <Page size="A4" style={styles.coverPage}>
      <Footer footerVersion={footerVersion} />
      <View style={styles.coverLogoWrap}>
        {logoDataUrl ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={logoDataUrl} style={styles.coverLogo} />
        ) : null}
      </View>
      {metadata.docCode ? (
        <Text style={styles.coverSubtitle}>{metadata.docCode}</Text>
      ) : null}
      {metadata.docName ? (
        <Text style={styles.coverTitle}>{metadata.docName}</Text>
      ) : null}
      {metadata.coverImageUrl ? (
        <View style={styles.coverImageWrap}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={metadata.coverImageUrl} style={styles.coverImage} />
        </View>
      ) : null}
      {(() => {
        const lang = DOCUMENT_LANGUAGES.find((l) => l.code === metadata.language);
        const label = lang?.nativeName;
        return label ? <Text style={styles.coverLanguage}>{label.toUpperCase()}</Text> : null;
      })()}
      <View style={styles.coverManufacturer} fixed>
        <View style={styles.coverColLeft}>
          {(metadata.manufacturerInfo || "")
            .split(/\r?\n/)
            .filter((l) => l.trim().length > 0)
            .map((l, i) => (
              <Text key={i}>{l}</Text>
            ))}
        </View>

        <View style={styles.coverColMid}>
          <Text>Tel. +420 222 362 620</Text>
        </View>
        <View style={styles.coverColRight}>
          <Text>info@jk-machinery.cz</Text>
          <Text>www.jk-machinery.cz</Text>
        </View>
      </View>
    </Page>
  );
}

// ---------- Disclaimer Page ----------
function DisclaimerBox({ title, text }: { title: string; text: string }) {
  const lines = (text || "").split(/\r?\n/).filter((l) => l.length > 0);
  return (
    <View style={styles.disclaimerBox} wrap={false}>
      <View style={styles.disclaimerHeader}>
        <Text style={styles.disclaimerHeaderText}>{title}</Text>
      </View>
      <View style={styles.disclaimerBody}>
        {lines.map((l, i) => (
          <Text key={i} style={styles.disclaimerLine}>{l}</Text>
        ))}
      </View>
    </View>
  );
}

function DisclaimerPage({ metadata, footerVersion }: { metadata: DocumentMetadata; footerVersion?: string }) {
  return (
    <Page size="A4" style={styles.page}>
      <Footer footerVersion={footerVersion} />
      <DisclaimerBox title={metadata.disclaimerWarning.title} text={metadata.disclaimerWarning.text} />
      <DisclaimerBox title={metadata.disclaimerNotice.title} text={metadata.disclaimerNotice.text} />
      <DisclaimerBox title={metadata.disclaimerConfidential.title} text={metadata.disclaimerConfidential.text} />
    </Page>
  );
}

// ---------- Document ----------
export interface DocumentPdfProps {
  title: string;
  blocks: Block[];
  includeToc?: boolean;
  pageMap?: PageMap;       // resolved page numbers for headings (pass 2)
  collector?: PageMap;     // collector to fill on render (pass 1)
  numberHeadings?: boolean;
  metadata?: DocumentMetadata;
  logoDataUrl?: string;
  measure?: MeasureContext; // pagination measurement mode (no visual change)
}

export function DocumentPdf({ title, blocks, includeToc = true, pageMap, collector, numberHeadings, metadata: metadataProp, logoDataUrl, measure }: DocumentPdfProps) {
  // Metadata mohou přijít neúplná (starší dokumenty, marker z Notion duplikátu),
  // proto je vždy sloučíme s výchozími hodnotami – jinak by render spadl.
  const metadata = metadataProp ? mergeMetadata(metadataProp) : undefined;
  const ordered = [...blocks].sort((a, b) => a.order - b.order);
  const headings = collectHeadings(ordered);
  const tocEntries = headings;
  const showToc = includeToc && (metadata?.showToc ?? true);
  const footerVersion = metadata?.footerVersion;
  const imageLabelPrefix = metadata?.imageLabelPrefix ?? "Obrázek č. ";
  let numbers: Map<string, string> | undefined;
  if (numberHeadings) {
    const counters = [0, 0, 0, 0];
    numbers = new Map();
    const lvlOf: Record<string, number> = { heading1: 1, heading2: 2, heading3: 3, heading4: 4 };
    for (const b of ordered) {
      const lvl = lvlOf[b.type];
      if (!lvl) continue;
      if (b.content?.unlisted) continue;
      counters[lvl - 1] += 1;
      for (let i = lvl; i < counters.length; i++) counters[i] = 0;
      numbers.set(b.id, counters.slice(0, lvl).join("."));
    }
  }

  // Sequential image numbering (image + image-table blocks).
  const imageNumbers = new Map<string, number>();
  {
    let n = 0;
    for (const b of ordered) {
      if (b.type === "image" || b.type === "image-table") {
        n += 1;
        imageNumbers.set(b.id, n);
      }
    }
  }

  const captionFor = (b: Block): string | undefined => {
    const n = imageNumbers.get(b.id);
    if (!n) return undefined;
    const alt = b.type === "image-table" ? (b.content?.image?.alt ?? "") : (b.content?.alt ?? "");
    const label = `${imageLabelPrefix}${n}`;
    return alt ? `${label}: ${alt}` : label;
  };

  return (
    <Document title={title}>
      {metadata && (
        <>
          <CoverPage metadata={metadata} logoDataUrl={logoDataUrl} footerVersion={footerVersion} />
          <DisclaimerPage metadata={metadata} footerVersion={footerVersion} />
        </>
      )}
      {showToc && pageMap && (
        <Page size="A4" style={styles.page}>
          <Footer footerVersion={footerVersion} />
          {!metadata && <Text style={styles.docTitle}>{title}</Text>}
          <Toc entries={tocEntries} pageMap={pageMap} numbers={numbers} />
        </Page>
      )}
      <Page size="A4" style={styles.page}>
        <Footer footerVersion={footerVersion} />
        {!showToc && !metadata && <Text style={styles.docTitle}>{title}</Text>}
        {(() => {
          // Řetězec nadpisů H2/H3/H4 bez obsahu mezi nimi – první obsahový
          // blok za řetězcem dostane značku začátku pro všechny jeho nadpisy.
          let headingChain: string[] = [];
          const consumed = new Set<string>();
          return ordered.map((b, bi) => {
            if (consumed.has(b.id)) return null;
            const isKeepHeading = b.type === "heading2" || b.type === "heading3" || b.type === "heading4";
            const nextFor = !isKeepHeading && b.type !== "heading1" && b.type !== "pagebreak" && headingChain.length > 0
              ? headingChain
              : undefined;
            const node = (
              <Fragment key={b.id}>
                {measure && isKeepHeading && (
                  <Text
                    style={{ height: 0, fontSize: 0 }}
                    render={({ pageNumber }) => {
                      measure.prevEndPages.set(b.id, pageNumber);
                      return "";
                    }}
                  />
                )}
                {wrapsNextText(b, ordered[bi + 1]) ? (() => {
                  const textBlock = ordered[bi + 1];
                  consumed.add(textBlock.id);
                  return <WrappedImageText image={b} text={textBlock} caption={captionFor(b)} measure={measure} measureNextFor={nextFor} />;
                })() : (
                  <BlockNode block={b} collector={collector} number={numbers?.get(b.id)} imageCaption={captionFor(b)} measure={measure} measureNextFor={nextFor} />
                )}
              </Fragment>
            );
            headingChain = isKeepHeading ? [...headingChain, b.id] : [];
            return node;
          });
        })()}
      </Page>
    </Document>
  );
}
