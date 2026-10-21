import { it } from "vitest";
import { Font, pdf } from "@react-pdf/renderer";
import { resolve } from "node:path";
import { DocumentPdf } from "./DocumentPdf";
Font.clear();
Font.register({ family: "Helvetica", src: resolve("src/assets/fonts/NotoSans-Regular.ttf") });
Font.register({ family: "NotoSans", fonts: [
  { src: resolve("src/assets/fonts/NotoSans-Regular.ttf"), fontWeight: "normal" },
  { src: resolve("src/assets/fonts/NotoSans-Bold.ttf"), fontWeight: "bold" },
] });
for (const html of ["<p>Line 1</p>", "<p>Line 1<br>Line 2</p>", "<p>Line 0</p>"]) it(html, async () => {
  await pdf(<DocumentPdf title="" includeToc={false} blocks={[{ id: "a", type: "text", order: 0, template: "default", content: { html } } as any]} />).toBuffer();
});
