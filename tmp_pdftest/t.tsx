import { JSDOM } from "jsdom";
const w = new JSDOM("").window as any;
(globalThis as any).DOMParser = w.DOMParser; (globalThis as any).Node = w.Node;
import { renderToFile } from "@react-pdf/renderer";
const { DocumentPdf } = await import("../src/lib/pdf/DocumentPdf");
const blocks:any = [{id:"1",order:0,type:"text",content:{html:"Normal <b>BOLDB</b> <strong>STRONG</strong> <i>ITAL</i> x<sup>2</sup>"}},
 {id:"2",order:1,type:"text",content:{html:"<p>Para <b>PBOLD</b></p>"}}];
await renderToFile(<DocumentPdf title="t" blocks={blocks} pageMap={new Map()} /> as any, "/tmp/pdft/out.pdf");
console.log("ok");
