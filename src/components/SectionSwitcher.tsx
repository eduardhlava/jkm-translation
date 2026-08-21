import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { FileText, FolderOpen, Languages } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { sectionAllowed, type Section } from "@/components/ProtectedRoute";

interface Props {
  showCreator?: boolean;
}

const base =
  "inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border border-b-0 transition-colors";

export const useSectionAccent = () => {
  const { pathname } = useLocation();
  if (pathname.startsWith("/document-creator")) return "hsl(var(--section-docs))";
  if (pathname.startsWith("/library")) return "hsl(var(--section-files))";
  return "hsl(var(--section-dict))";
};

const SectionSwitcher = (_props: Props) => {
  const { pathname } = useLocation();
  const { profile } = useAuth();

  const tabs = [
    {
      to: "/",
      section: "dictionary" as Section,
      label: "Překlady slovníku",
      icon: Languages,
      active: pathname === "/",
      activeClass: "bg-section-dict text-section-foreground border-section-dict",
      iconClass: "text-section-dict",
    },
    {
      to: "/document-creator",
      section: "documents" as Section,
      label: "Tvorba dokumentů",
      icon: FileText,
      active: pathname.startsWith("/document-creator"),
      activeClass: "bg-section-docs text-section-foreground border-section-docs",
      iconClass: "text-section-docs",
    },
    {
      to: "/library",
      section: "files" as Section,
      label: "Soubory",
      icon: FolderOpen,
      active: pathname.startsWith("/library"),
      activeClass: "bg-section-files text-section-foreground border-section-files",
      iconClass: "text-section-files",
    },
  ];

  return (
    <nav className="inline-flex items-end gap-1 self-end ml-5 -mb-4">
      {tabs.map((tab) => {
        if (!sectionAllowed(profile, tab.section)) return null;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={cn(
              base,
              tab.active
                ? tab.activeClass
                : "bg-background text-muted-foreground hover:bg-muted border-border hover:text-foreground",
            )}
          >
            <Icon
              className={cn(
                "w-4 h-4",
                tab.active ? "text-current" : tab.iconClass,
              )}
            />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
};

export default SectionSwitcher;
