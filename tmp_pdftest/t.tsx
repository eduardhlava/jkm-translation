import { JSDOM } from "jsdom";
const w = new JSDOM("").window as any;
(globalThis as any).DOMParser = w.DOMParser; (globalThis as any).Node = w.Node;
import { renderToFile } from "@react-pdf/renderer";
const { DocumentPdf } = await import("../src/lib/pdf/DocumentPdf");
const blocks:any = [{id:"1",order:0,type:"text",content:{html:"Normal <b>BOLDB</b> <strong>STRONG</strong> <i>ITAL</i> x<sup>2</sup>"}},
 {id:"2",order:1,type:"text",content:{html:"Line1 <b>tučně</b> a{id:"2",order:1,type:"text",content:{html:"<p>Para <b>PBOLD</b></p>"}}amp;b<br>Line2 <span style=\"font-weight: bold\">span</span><div>Div <i>kurz</i> <b><i>obojí</i></b> H<sub>2</sub>O</div>"}}];
await renderToFile(<DocumentPdf title="t" blocks={blocks} pageMap={new Map()} /> as any, "/tmp/pdft/out.pdf");
console.log("ok");
