import { it } from "vitest";
import { Font, pdf } from "@react-pdf/renderer";
import { resolve } from "node:path";
import { writeFileSync, readFileSync } from "node:fs";
import { DocumentPdf } from "./DocumentPdf";
import type { Block } from "@/components/BlockEditor/types";

Font.clear();
Font.register({ family: "Helvetica", src: resolve("src/assets/fonts/NotoSans-Regular.ttf") });
Font.register({ family: "NotoSans", fonts: [
  { src: resolve("src/assets/fonts/NotoSans-Regular.ttf"), fontWeight: "normal" },
  { src: resolve("src/assets/fonts/NotoSans-Bold.ttf"), fontWeight: "bold" },
] });

it("writes a visual check PDF", async () => {
  const img = `data:image/png;base64,${readFileSync(resolve("src/lib/pdf/fixtures/portrait.png")).toString("base64")}`;
  const blocks: Block[] = [
    { id: "l", type: "image", template: "default", order: 0, content: { url: img, alt: "Vlevo", size: "half", position: "left" } },
    { id: "r", type: "image", template: "default", order: 1, content: { url: img, alt: "Vpravo", size: "half", position: "right" } },
    { id: "c", type: "image", template: "default", order: 2, content: { url: img, alt: "Střed", size: "half", position: "center" } },
  ];
  const buf = await pdf(<DocumentPdf title="" blocks={blocks} includeToc={false} />).toBuffer();
  writeFileSync("/tmp/half-align.pdf", buf);
}, 20000);
