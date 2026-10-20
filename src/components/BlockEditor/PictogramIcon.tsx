import { PICTOGRAM_PATHS } from "./pictogramPaths";
import type { Pictogram } from "./types";

/** Shared editor pictogram (same vector paths as the PDF). */
export default function PictogramIcon({ kind, size = 28, className }: { kind?: Pictogram; size?: number; className?: string }) {
  if (!kind || kind === "none") return null;
  const d = PICTOGRAM_PATHS[kind as keyof typeof PICTOGRAM_PATHS];
  if (!d) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d={d} fill="#333333" fillRule="evenodd" />
    </svg>
  );
}
