import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type PdfDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<any>;
  destroy?: () => Promise<void> | void;
};

function PdfPageCanvas({ pdfDocument, pageNumber, scale }: { pdfDocument: PdfDocument; pageNumber: number; scale: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<unknown> } | null = null;

    (async () => {
      const page = await pdfDocument.getPage(pageNumber);
      if (cancelled || !canvasRef.current) return;

      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      if (!context) return;

      const outputScale = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      renderTask = page.render({
        canvasContext: context,
        viewport,
        transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
      });
      await renderTask.promise;
    })().catch((error) => {
      if (!cancelled && error?.name !== "RenderingCancelledException") {
        console.error("[pdf] canvas render failed", error);
      }
    });

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdfDocument, pageNumber, scale]);

  return <canvas ref={canvasRef} className="bg-background shadow-lg" />;
}

export default function PdfCanvasPreview({ blob }: { blob: Blob | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDocument, setPdfDocument] = useState<PdfDocument | null>(null);
  const [scale, setScale] = useState(1.25);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateScale = () => {
      const availableWidth = Math.max(320, element.clientWidth - 48);
      setScale(Math.max(0.6, Math.min(1.55, availableWidth / 595.28)));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: ReturnType<typeof pdfjsLib.getDocument> | null = null;

    setPdfDocument(null);
    setError(null);
    if (!blob) return;

    (async () => {
      const data = new Uint8Array(await blob.arrayBuffer());
      loadingTask = pdfjsLib.getDocument({ data });
      const doc = (await loadingTask.promise) as PdfDocument;
      if (cancelled) {
        await doc.destroy?.();
        return;
      }
      setPdfDocument(doc);
    })().catch((e) => {
      if (!cancelled) {
        console.error("[pdf] pdf.js load failed", e);
        setError(e instanceof Error ? e.message : "PDF se nepodařilo načíst.");
      }
    });

    return () => {
      cancelled = true;
      void loadingTask?.destroy();
      setPdfDocument((doc) => {
        void doc?.destroy?.();
        return null;
      });
    };
  }, [blob]);

  return (
    <div ref={containerRef} className="h-full overflow-auto bg-muted/30">
      {!blob || (!pdfDocument && !error) ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Načítám náhled…
        </div>
      ) : error ? (
        <div className="flex h-full items-center justify-center p-6 text-center text-sm text-destructive">
          {error}
        </div>
      ) : (
        <div className="flex min-h-full flex-col items-center gap-6 p-6">
          {Array.from({ length: pdfDocument?.numPages ?? 0 }, (_, index) => (
            <PdfPageCanvas key={index + 1} pdfDocument={pdfDocument!} pageNumber={index + 1} scale={scale} />
          ))}
        </div>
      )}
    </div>
  );
}