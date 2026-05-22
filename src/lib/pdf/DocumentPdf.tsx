import { Document, Page, Text, View, Image, Link, StyleSheet, Font } from "@react-pdf/renderer";
import type { Block } from "@/components/BlockEditor/types";

// ---------- Styles ----------
const styles = StyleSheet.create({
  page: {
    paddingTop: 50,
    paddingBottom: 60,
    paddingHorizontal: 50,
    fontSize: 11,
    lineHeight: 1.45,
    fontFamily: "Helvetica",
    color: "#111827",
  },
  docTitle: { fontSize: 22, lineHeight: 1.2, fontFamily: "Helvetica-Bold", marginBottom: 14 },
  h1Wrap: { width: "100%", marginTop: 14, marginBottom: 6 },
  h2Wrap: { width: "100%", marginTop: 12, marginBottom: 5 },
  h3Wrap: { width: "100%", marginTop: 10, marginBottom: 4 },
  h4Wrap: { width: "100%", marginTop: 8, marginBottom: 4 },
  h1: { fontSize: 18, lineHeight: 1.25, fontFamily: "Helvetica-Bold" },
  h2: { fontSize: 15, lineHeight: 1.25, fontFamily: "Helvetica-Bold" },
  h3: { fontSize: 13, lineHeight: 1.25, fontFamily: "Helvetica-Bold" },
  h4: { fontSize: 12, lineHeight: 1.25, fontFamily: "Helvetica-Bold" },
  textBlock: { width: "100%" },
  paragraphWrap: { width: "100%", marginBottom: 6 },
  p: { fontSize: 11, lineHeight: 1.45 },
  li: { flexDirection: "row", marginBottom: 2, fontSize: 11, lineHeight: 1.45 },
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
  th: { backgroundColor: "#f3f4f6", fontFamily: "Helvetica-Bold" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 50,
    right: 50,
    height: 12,
    textAlign: "center",
    fontSize: 9,
    lineHeight: 1,
    color: "#6b7280",
  },
  tocTitle: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 10 },
  tocRow: { flexDirection: "row", marginBottom: 3, fontSize: 11 },
  tocLeft: { flex: 1 },
  tocPage: { width: 30, textAlign: "right" },
  tocLink: { color: "#111827", textDecoration: "none" },
});

const calloutCfg = {
  alert:   { icon: "!", border: "#dc2626", bg: "#fef2f2", color: "#991b1b" },
  info:    { icon: "i", border: "#2563eb", bg: "#eff6ff", color: "#1e3a8a" },
  warning: { icon: "!", border: "#d97706", bg: "#fffbeb", color: "#92400e" },
} as const;

// ---------- HTML → inline runs ----------
type Run = { text: string; bold?: boolean; italic?: boolean; underline?: boolean; href?: string };

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
      el.childNodes.forEach((c) => walk(c, ann));
      flushPara();
      return;
    }
    const next = { ...ann };
    if (tag === "STRONG" || tag === "B") next.bold = true;
    if (tag === "EM" || tag === "I") next.italic = true;
    if (tag === "U") next.underline = true;
    if (tag === "A") next.href = el.getAttribute("href") ?? undefined;
    el.childNodes.forEach((c) => walk(c, next));
  };

  root.childNodes.forEach((c) => walk(c, {}));
  if (current.length) flushPara();
  return paragraphs.length ? paragraphs : [[]];
}

function fontFamilyFor(r: Run): string {
  if (r.bold && r.italic) return "Helvetica-BoldOblique";
  if (r.bold) return "Helvetica-Bold";
  if (r.italic) return "Helvetica-Oblique";
  return "Helvetica";
}

function RunsText({ runs }: { runs: Run[] }) {
  const hasInlineStyles = runs.some((r) => r.bold || r.italic || r.underline || r.href);
  if (!hasInlineStyles) return <>{runs.map((r) => r.text).join("")}</>;

  return (
    <>
      {runs.map((r, i) => {
        const style: any = { fontFamily: fontFamilyFor(r) };
        if (r.underline || r.href) style.textDecoration = "underline";
        if (r.href) style.color = "#2563eb";
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
    if (b.type === "heading1") out.push({ id: b.id, level: 1, text: b.content?.text ?? "" });
    else if (b.type === "heading2") out.push({ id: b.id, level: 2, text: b.content?.text ?? "" });
    else if (b.type === "heading3") out.push({ id: b.id, level: 3, text: b.content?.text ?? "" });
  });
  return out;
}

// ---------- Block renderers ----------
function Heading({ block, level, collector }: { block: Block; level: 1 | 2 | 3 | 4; collector?: PageMap }) {
  const styleMap = { 1: styles.h1, 2: styles.h2, 3: styles.h3, 4: styles.h4 } as const;
  const wrapStyleMap = { 1: styles.h1Wrap, 2: styles.h2Wrap, 3: styles.h3Wrap, 4: styles.h4Wrap } as const;
  const text = block.content?.text ?? "";
  return (
    <View wrap={false} style={wrapStyleMap[level]}>
      <Text style={styleMap[level]}>{text}</Text>
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

function TextBlock({ block }: { block: Block }) {
  const paragraphs = parseInline(block.content?.html ?? "");
  // Detect list items inside the html quickly: re-parse for ul/ol structure
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
          if (t.trim()) nodes.push(<View key={key++} style={styles.paragraphWrap}><Text style={styles.p}>{t}</Text></View>);
        return;
      }
      if (n.nodeType !== Node.ELEMENT_NODE) return;
      const el = n as HTMLElement;
      const tag = el.tagName.toUpperCase();
      if (tag === "UL" || tag === "OL") {
        const items = Array.from(el.children).filter((c) => c.tagName.toUpperCase() === "LI");
        items.forEach((li, i) => {
          const runs = renderInlineNode(li);
          nodes.push(
            <View key={key++} style={styles.li}>
              <Text style={styles.liBullet}>{tag === "OL" ? `${i + 1}.` : "•"}</Text>
              <Text style={styles.liContent}><RunsText runs={runs} /></Text>
            </View>
          );
        });
        return;
      }
      if (tag === "P") {
        const runs = parseInline(el.innerHTML).flat();
        if (runs.length) nodes.push(<View key={key++} style={styles.paragraphWrap}><Text style={styles.p}><RunsText runs={runs} /></Text></View>);
        return;
      }
      // Fallback: treat as paragraph
      const runs = parseInline(el.outerHTML).flat();
      if (runs.length) nodes.push(<View key={key++} style={styles.paragraphWrap}><Text style={styles.p}><RunsText runs={runs} /></Text></View>);
    });
  };

  if (!root || root.children.length === 0) {
    // Plain runs
    return (
      <>
        {paragraphs.map((runs, i) =>
          runs.length ? <View key={i} style={styles.paragraphWrap}><Text style={styles.p}><RunsText runs={runs} /></Text></View> : null
        )}
      </>
    );
  }
  renderRootChildren(root);
  return <View style={styles.textBlock}>{nodes}</View>;
}

function ImageBlock({ block }: { block: Block }) {
  const url = block.content?.url;
  const alt = block.content?.alt;
  if (!url) return null;
  const requestedWidth = Number(block.content?.width);
  const width = Number.isFinite(requestedWidth) && requestedWidth > 0
    ? Math.max(120, Math.min(440, requestedWidth))
    : 340;
  return (
    <View wrap={false} style={styles.imageBlock}>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <Image src={url} style={[styles.image, { width }] as any} />
      {alt ? <Text style={styles.caption}>{alt}</Text> : null}
    </View>
  );
}

function TableBlock({ block }: { block: Block }) {
  const rows: string[][] = block.content?.rows ?? [];
  const headerRow = !!block.content?.headerRow;
  if (rows.length === 0) return null;
  return (
    <View style={styles.table}>
      {rows.map((row, ri) => (
        <View key={ri} style={styles.tr} wrap={false}>
          {row.map((cell, ci) => (
            <Text key={ci} style={[styles.td, headerRow && ri === 0 ? styles.th : {}] as any}>
              {cell}
            </Text>
          ))}
        </View>
      ))}
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

function BlockNode({ block, collector }: { block: Block; collector?: PageMap }) {
  switch (block.type) {
    case "heading1": return <Heading block={block} level={1} collector={collector} />;
    case "heading2": return <Heading block={block} level={2} collector={collector} />;
    case "heading3": return <Heading block={block} level={3} collector={collector} />;
    case "heading4": return <Heading block={block} level={4} />;
    case "text":     return <TextBlock block={block} />;
    case "image":    return <ImageBlock block={block} />;
    case "table":    return <TableBlock block={block} />;
    case "alert":
    case "info":
    case "warning":  return <CalloutBlock block={block} />;
    default: return null;
  }
}

// ---------- TOC ----------
function Toc({ entries, pageMap }: { entries: HeadingEntry[]; pageMap: PageMap }) {
  if (entries.length === 0) return null;
  return (
    <View>
      <Text style={styles.tocTitle}>Obsah</Text>
      {entries.map((e) => {
        const indent = (e.level - 1) * 14;
        const pn = pageMap.get(e.id);
        return (
          <View key={e.id} style={styles.tocRow} wrap={false}>
            <Text style={[styles.tocLeft, { paddingLeft: indent }] as any}>{e.text || "—"}</Text>
            <Text style={styles.tocPage}>{pn ?? ""}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ---------- Footer ----------
function Footer() {
  return (
    <Text fixed style={styles.footer} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
  );
}

// ---------- Document ----------
export interface DocumentPdfProps {
  title: string;
  blocks: Block[];
  includeToc?: boolean;
  pageMap?: PageMap;       // resolved page numbers for headings (pass 2)
  collector?: PageMap;     // collector to fill on render (pass 1)
}

export function DocumentPdf({ title, blocks, includeToc = true, pageMap, collector }: DocumentPdfProps) {
  const ordered = [...blocks].sort((a, b) => a.order - b.order);
  const headings = collectHeadings(ordered);
  const tocEntries = headings;

  return (
    <Document title={title}>
      {includeToc && pageMap && (
        <Page size="A4" style={styles.page}>
          <Footer />
          <Text style={styles.docTitle}>{title}</Text>
          <Toc entries={tocEntries} pageMap={pageMap} />
        </Page>
      )}
      <Page size="A4" style={styles.page}>
        <Footer />
        {!includeToc && <Text style={styles.docTitle}>{title}</Text>}
        {ordered.map((b) => (
          <BlockNode key={b.id} block={b} collector={collector} />
        ))}
      </Page>
    </Document>
  );
}
