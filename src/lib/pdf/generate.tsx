import { pdf } from "@react-pdf/renderer";
import type { Block } from "@/components/BlockEditor/types";
import { DocumentPdf, type PageMap } from "./DocumentPdf";

export async function generateDocumentPdf(
  title: string,
  blocks: Block[],
  options: { numberHeadings?: boolean } = {},
): Promise<Blob> {
  const { numberHeadings } = options;
  // Pass 1: render with the real TOC layout and collect the actual page numbers.
  const collector: PageMap = new Map();
  await pdf(
    <DocumentPdf
      title={title}
      blocks={blocks}
      includeToc
      pageMap={new Map()}
      collector={collector}
      numberHeadings={numberHeadings}
    />,
  ).toBlob();

  // Pass 2: final document with TOC
  return await pdf(
    <DocumentPdf
      title={title}
      blocks={blocks}
      includeToc
      pageMap={collector}
      numberHeadings={numberHeadings}
    />,
  ).toBlob();
}
