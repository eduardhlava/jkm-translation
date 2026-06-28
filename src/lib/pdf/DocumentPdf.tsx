import { Document, Page, Text, View, Image, Link, StyleSheet, Font, Svg, Polygon, Path, Circle } from "@react-pdf/renderer";
import type { Block, Pictogram } from "@/components/BlockEditor/types";
import notoRegular from "@/assets/fonts/NotoSans-Regular.ttf?url";
import notoBold from "@/assets/fonts/NotoSans-Bold.ttf?url";
import notoItalic from "@/assets/fonts/NotoSans-Italic.ttf?url";
import notoBoldItalic from "@/assets/fonts/NotoSans-BoldItalic.ttf?url";
import { DOCUMENT_LANGUAGES, type DocumentMetadata } from "@/components/DocumentMetadata/types";

Font.register({
  family: "NotoSans",
  fonts: [
    { src: notoRegular, fontWeight: "normal" },
    { src: notoBold, fontWeight: "bold" },
    { src: notoItalic, fontStyle: "italic" },
    { src: notoBoldItalic, fontWeight: "bold", fontStyle: "italic" },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

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
  h1Wrap: { width: "100%", marginTop: 18, marginBottom: 8 },
  h2Wrap: { width: "100%", marginTop: 14, marginBottom: 6 },
  h3Wrap: { width: "100%", marginTop: 10, marginBottom: 4 },
  h4Wrap: { width: "100%", marginTop: 8, marginBottom: 3 },
  h1: { fontSize: 16, lineHeight: 1.25, fontFamily: "NotoSans", fontWeight: "bold" },
  h2: { fontSize: 13, lineHeight: 1.25, fontFamily: "NotoSans", fontWeight: "bold" },
  h3: { fontSize: 11.5, lineHeight: 1.25, fontFamily: "NotoSans", fontWeight: "bold" },
  h4: { fontSize: 10.5, lineHeight: 1.25, fontFamily: "NotoSans", fontWeight: "bold" },
  textBlock: { width: "100%" },
  paragraphWrap: { width: "100%", marginBottom: 6 },
  p: { fontSize: 10.5, lineHeight: 1.5 },
  li: { flexDirection: "row", marginBottom: 2, fontSize: 10.5, lineHeight: 1.5 },
  liBullet: { width: 14 },
  liContent: { flex: 1 },
  imageBlock: { width: "100%", marginVertical: 10, alignItems: "center" },
  image: { objectFit: "contain" },
  caption: { fontSize: 9, color: "#6b7280", textAlign: "center", marginTop: 2 },
  callout: {
    flexDirection: "row",
    gap: 8,
    padding: 10,
    marginVertical: 6,
    borderRadius: 4,
    borderLeftWidth: 4,
  },
  calloutIcon: { fontSize: 14 },
  calloutText: { flex: 1 },
  table: { borderWidth: 1, borderColor: "#d1d5db", marginVertical: 6 },
  tr: { flexDirection: "row" },
  td: { flex: 1, padding: 5, borderRightWidth: 1, borderBottomWidth: 1, borderColor: "#d1d5db", fontSize: 10 },
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
type Run = { text: string; bold?: boolean; italic?: boolean; underline?: boolean; href?: string; bg?: string };

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
  const hasInlineStyles = runs.some((r) => r.bold || r.italic || r.underline || r.href || r.bg);
  if (!hasInlineStyles) return <>{runs.map((r) => r.text).join("")}</>;

  return (
    <>
      {runs.map((r, i) => {
        const style: any = fontStyleFor(r);
        if (r.underline || r.href) style.textDecoration = "underline";
        if (r.href) style.color = "#2563eb";
        if (r.bg) style.backgroundColor = r.bg;
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
function Heading({ block, level, collector, number }: { block: Block; level: 1 | 2 | 3 | 4; collector?: PageMap; number?: string }) {
  const styleMap = { 1: styles.h1, 2: styles.h2, 3: styles.h3, 4: styles.h4 } as const;
  const wrapStyleMap = { 1: styles.h1Wrap, 2: styles.h2Wrap, 3: styles.h3Wrap, 4: styles.h4Wrap } as const;
  const text = block.content?.text ?? "";
  const prefixed = number ? `${number}  ${text}` : text;
  return (
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
  const color = "#000000";
  const fill = "#ffffff";
  const strokeWidth = 2;

  const renderSymbol = () => {
    switch (kind) {
      case "alert":
      case "alert-electric":
        return (
          <>
            <Path d="M12 9 L12 15" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
            <Circle cx={12} cy={18} r={1.2} fill={color} />
          </>
        );
      case "info":
        return (
          <>
            <Circle cx={12} cy={8} r={1.2} fill={color} />
            <Path d="M12 11 L12 17" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
          </>
        );
      case "recycling":
        return (
          <>
            <Path d="M12 4 Q15 8 17 12" stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
            <Polygon points="17,12 15.45,10.84 16.64,10.10" fill={color} />
            <Path d="M17 12 Q12 14 7 12" stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
            <Polygon points="7,12 8.80,11.30 8.80,12.70" fill={color} />
            <Path d="M7 12 Q9 8 12 4" stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
            <Polygon points="12,4 11.64,5.90 10.45,5.16" fill={color} />
          </>
        );
      default:
        return null;
    }
  };

  const renderShape = () => {
    switch (kind) {
      case "alert":
      case "alert-electric":
        return (
          <Polygon points="12,2 22,21 2,21" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
        );
      case "info":
      case "recycling":
        return (
          <Circle cx={12} cy={12} r={10} fill={fill} stroke={color} strokeWidth={strokeWidth} />
        );
      default:
        return null;
    }
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {renderShape()}
      {renderSymbol()}
    </Svg>
  );
}


function TextBlock({ block }: { block: Block }) {
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
    parent.childNodes.forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) {
        const t = n.textContent ?? "";
        if (t.trim()) nodes.push(<View key={key++} style={styles.paragraphWrap}><Text style={defaultPStyle}>{t}</Text></View>);
        return;
      }
      if (n.nodeType !== Node.ELEMENT_NODE) return;
      const el = n as HTMLElement;
      const tag = el.tagName.toUpperCase();
      if (tag === "UL" || tag === "OL") {
        const items = Array.from(el.children).filter((c) => c.tagName.toUpperCase() === "LI");
        items.forEach((li, i) => {
          const runs = renderInlineNode(li);
          const s = parseStyleAttr(li);
          const liStyle = { ...defaultLiStyle, ...(s.fontSize ? { fontSize: s.fontSize } : {}) };
          const contentStyle = { ...styles.liContent, ...(s.textAlign ? { textAlign: s.textAlign } : {}), ...(s.fontSize ? { fontSize: s.fontSize } : {}) } as any;
          nodes.push(
            <View key={key++} style={liStyle}>
              <Text style={styles.liBullet}>{tag === "OL" ? `${i + 1}.` : "•"}</Text>
              <Text style={contentStyle}><RunsText runs={runs} /></Text>
            </View>
          );
        });
        return;
      }
      if (tag === "P" || tag === "DIV") {
        const runs = parseInline(el.innerHTML).flat();
        if (!runs.length) return;
        const s = parseStyleAttr(el);
        const pStyle = { ...defaultPStyle, ...(s.textAlign ? { textAlign: s.textAlign } : {}), ...(s.fontSize ? { fontSize: s.fontSize } : {}) } as any;
        nodes.push(<View key={key++} style={styles.paragraphWrap}><Text style={pStyle}><RunsText runs={runs} /></Text></View>);
        return;
      }
      // Fallback: treat as paragraph
      const runs = parseInline(el.outerHTML).flat();
      if (runs.length) nodes.push(<View key={key++} style={styles.paragraphWrap}><Text style={defaultPStyle}><RunsText runs={runs} /></Text></View>);
    });
  };

  let body: JSX.Element;
  if (!root || root.children.length === 0) {
    const paragraphs = parseInline(block.content?.html ?? "");
    body = (
      <View style={styles.textBlock}>
        {paragraphs.map((runs, i) =>
          runs.length ? <View key={i} style={styles.paragraphWrap}><Text style={defaultPStyle}><RunsText runs={runs} /></Text></View> : null
        )}
      </View>
    );
  } else {
    renderRootChildren(root);
    body = <View style={styles.textBlock}>{nodes}</View>;
  }

  const pictogram = block.content?.pictogram;
  if (pictogram && pictogram !== "none") {
    return (
      <View style={{ position: "relative", marginVertical: 4 }} wrap={false}>
        <View style={{ position: "absolute", left: -36, top: 2, width: 30, alignItems: "center" }}>
          <PictogramSvg kind={pictogram} size={26} />
        </View>
        {body}
      </View>
    );
  }
  return body;
}

function ImageBlock({ block, captionOverride }: { block: Block; captionOverride?: string }) {
  const url = block.content?.url;
  const alt = block.content?.alt;
  if (!url) return null;
  const requestedWidth = Number(block.content?.width);
  const width = Number.isFinite(requestedWidth) && requestedWidth > 0
    ? Math.max(120, Math.min(440, requestedWidth))
    : 340;
  const caption = captionOverride !== undefined ? captionOverride : alt;
  return (
    <View wrap={false} style={styles.imageBlock}>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <Image src={url} style={[styles.image, { width }] as any} />
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

function TableBlock({ block }: { block: Block }) {
  const rows: string[][] = block.content?.rows ?? [];
  const headerRow = !!block.content?.headerRow;
  const colWidths: number[] | undefined = block.content?.colWidths;
  const rowColors: Array<string | null> = block.content?.rowColors ?? [];
  if (rows.length === 0) return null;
  const cols = rows[0]?.length ?? 0;
  const hasWidths = !!colWidths && colWidths.length === cols && cols > 0;
  return (
    <View style={styles.table}>
      {rows.map((row, ri) => {
        const rowBg = rowColors[ri] ?? null;
        return (
          <View key={ri} style={[styles.tr, rowBg ? { backgroundColor: rowBg } : {}] as any} wrap={false}>
            {row.map((cell, ci) => {
              const wStyle = hasWidths
                ? { width: `${colWidths![ci]}%`, flexGrow: 0, flexShrink: 0, flexBasis: `${colWidths![ci]}%` }
                : { flex: 1 };
              const isHeader = headerRow && ri === 0 && !rowBg;
              return (
                <Text key={ci} style={[styles.td, wStyle, isHeader ? styles.th : {}, headerRow && ri === 0 ? { fontFamily: "NotoSans", fontWeight: "bold" } : {}] as any}>
                  {cell}
                </Text>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

function CalloutBlock({ block }: { block: Block }) {
  const cfg = calloutCfg[block.type as keyof typeof calloutCfg];
  return (
    <View
      style={[
        styles.callout,
        { borderLeftColor: cfg.border, backgroundColor: cfg.bg, color: cfg.color },
      ] as any}
      wrap={false}
    >
      <Text style={styles.calloutIcon}>{cfg.icon}</Text>
      <Text style={styles.calloutText}>{block.content?.text ?? ""}</Text>
    </View>
  );
}

function withPictogram(block: Block, node: JSX.Element) {
  const pictogram = block.content?.pictogram;
  if (!pictogram || pictogram === "none") return node;
  return (
    <View style={{ position: "relative", marginVertical: 4 }} wrap={false}>
      <View style={{ position: "absolute", left: -36, top: 2, width: 30, alignItems: "center" }}>
        <PictogramSvg kind={pictogram} size={26} />
      </View>
      {node}
    </View>
  );
}

function BlockNode({ block, collector, number, imageCaption }: { block: Block; collector?: PageMap; number?: string; imageCaption?: string }) {
  switch (block.type) {
    case "heading1": return <Heading block={block} level={1} collector={collector} number={number} />;
    case "heading2": return <Heading block={block} level={2} collector={collector} number={number} />;
    case "heading3": return <Heading block={block} level={3} collector={collector} number={number} />;
    case "heading4": return <Heading block={block} level={4} number={number} />;
    case "text":     return <TextBlock block={block} />;
    case "image":    return withPictogram(block, <ImageBlock block={block} captionOverride={imageCaption} />);
    case "table":    return withPictogram(block, <TableBlock block={block} />);
    case "image-table": return withPictogram(block, (
      <>
        <ImageBlock block={{ ...block, type: "image", content: block.content?.image ?? {} } as Block} captionOverride={imageCaption} />
        <TableBlock block={{ ...block, type: "table", content: block.content?.table ?? { headerRow: true, rows: [] } } as Block} />
      </>
    ));
    case "alert":
    case "info":
    case "warning":  return <CalloutBlock block={block} />;
    case "pagebreak": return <View break />;
    default: return null;

  }
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
      <View style={styles.coverManufacturer} fixed>
        <View style={styles.coverColLeft}>
          <Text>Údaje o výrobci:</Text>
          <Text>JK Machinery a.s.</Text>
          <Text>Politických vězňů 912/10</Text>
          <Text>CZ 110 00 Praha 1</Text>
          <Text>Česká republika</Text>
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
}

export function DocumentPdf({ title, blocks, includeToc = true, pageMap, collector, numberHeadings, metadata, logoDataUrl }: DocumentPdfProps) {
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
        {ordered.map((b) => (
          <BlockNode key={b.id} block={b} collector={collector} number={numbers?.get(b.id)} imageCaption={captionFor(b)} />
        ))}
      </Page>
    </Document>
  );
}
