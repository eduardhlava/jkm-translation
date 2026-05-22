import { pdf } from "@react-pdf/renderer";
import type { Block } from "@/components/BlockEditor/types";
import { DocumentPdf, type PageMap, collectHeadings } from "./DocumentPdf";

export async function generateDocumentPdf(title: string, blocks: Block[]): Promise<Blob> {
  // Pass 1: render with the real TOC layout and collect the actual page numbers.
  // The TOC reserves a fixed-width page-number column, so blank numbers do not alter pagination.
  const collector: PageMap = new Map();
  await pdf(
    <DocumentPdf title={title} blocks={blocks} includeToc pageMap={new Map()} collector={collector} />
  ).toBlob();

  // Pass 2: final document with TOC
  return await pdf(
    <DocumentPdf title={title} blocks={blocks} includeToc pageMap={collector} />
  ).toBlob();
}
