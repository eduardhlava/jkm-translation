import { pdf } from "@react-pdf/renderer";
import type { Block } from "@/components/BlockEditor/types";
import { DocumentPdf, type PageMap, collectHeadings } from "./DocumentPdf";

export async function generateDocumentPdf(title: string, blocks: Block[]): Promise<Blob> {
  const headings = collectHeadings(blocks);

  // Pass 1: render once to collect page numbers of headings (without TOC)
  const collector: PageMap = new Map();
  await pdf(
    <DocumentPdf title={title} blocks={blocks} includeToc={false} collector={collector} />
  ).toBlob();

  // Estimate how many pages the TOC will occupy
  // (~38 rows per page after the "Obsah" heading; very conservative)
  const tocPages = Math.max(1, Math.ceil(headings.length / 38));

  // Adjust collected page numbers by TOC offset
  const adjusted: PageMap = new Map();
  collector.forEach((p, id) => adjusted.set(id, p + tocPages));

  // Pass 2: final document with TOC
  return await pdf(
    <DocumentPdf title={title} blocks={blocks} includeToc={true} pageMap={adjusted} />
  ).toBlob();
}
