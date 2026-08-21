import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { FileText, FolderOpen, Languages } from "lucide-react";

interface Props {
  showCreator: boolean;
}

const base =
  "inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border transition-colors relative top-px";

const SectionSwitcher = ({ showCreator }: Props) => {
  const { pathname } = useLocation();

  const tabs = [
    {
      to: "/",
      label: "Překlady slovníku",
      icon: Languages,
      active: pathname === "/",
      activeClass:
        "bg-primary text-primary-foreground border-border border-b-background",
      iconClass: "text-primary",
    },
    {
      to: "/document-creator",
      label: "Tvorba dokumentů",
      icon: FileText,
      active: pathname.startsWith("/document-creator"),
      activeClass:
        "bg-warning text-warning-foreground border-border border-b-background",
      iconClass: "text-warning",
    },
    {
      to: "/library",
      label: "Soubory",
      icon: FolderOpen,
      active: pathname.startsWith("/library"),
      activeClass:
        "bg-success text-success-foreground border-border border-b-background",
      iconClass: "text-success",
    },
  ];

  return (
    <nav className="inline-flex items-end gap-1 border-b">
      {tabs.map((tab) => {
        if (tab.to !== "/" && !showCreator) return null;
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
