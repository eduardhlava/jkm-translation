import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { FileText, Languages } from "lucide-react";

interface Props {
  showCreator: boolean;
}

const SectionSwitcher = ({ showCreator }: Props) => {
  const { pathname } = useLocation();
  const tab = (active: boolean) =>
    cn(
      "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
      active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
    );
  return (
    <nav className="inline-flex items-center gap-1 rounded-lg border bg-background/60 p-1">
      <Link to="/" className={tab(pathname === "/")}>
        <Languages className="w-4 h-4" /> JKM Translator
      </Link>
      {showCreator && (
        <Link to="/document-creator" className={tab(pathname.startsWith("/document-creator"))}>
          <FileText className="w-4 h-4" /> JKM Document Creator
        </Link>
      )}
    </nav>
  );
};

export default SectionSwitcher;
