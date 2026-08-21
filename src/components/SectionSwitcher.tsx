import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { FileText, FolderOpen, Languages } from "lucide-react";

interface Props {
  showCreator: boolean;
}

const base =
  "inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border-t border-x transition-colors relative top-px";

const SectionSwitcher = ({ showCreator }: Props) => {
  const { pathname } = useLocation();

  const tabs = [
    {
      to: "/",
      label: "Translator",
      icon: Languages,
      active: pathname === "/",
      color: "primary",
      iconClass: "text-primary",
    },
    {
      to: "/document-creator",
      label: "Document Creator",
      icon: FileText,
      active: pathname.startsWith("/document-creator"),
      color: "warning",
      iconClass: "text-warning",
    },
    {
      to: "/library",
      label: "Soubory",
      icon: FolderOpen,
      active: pathname.startsWith("/library"),
      color: "success",
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
                ? cn(
                    `bg-${tab.color} text-${tab.color}-foreground border-transparent`,
                    tab.color === "primary" && "bg-primary text-primary-foreground",
                    tab.color === "warning" && "bg-warning text-warning-foreground",
                    tab.color === "success" && "bg-success text-success-foreground",
                  )
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
