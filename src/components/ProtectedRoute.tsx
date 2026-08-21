import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export type Section = "dictionary" | "documents" | "files";

interface Props {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireSection?: Section;
}

export const sectionAllowed = (
  profile: { can_dictionary?: boolean; can_documents?: boolean; can_files?: boolean } | null,
  section: Section,
) => {
  if (!profile) return false;
  if (section === "dictionary") return profile.can_dictionary !== false;
  if (section === "documents") return profile.can_documents !== false;
  return profile.can_files !== false;
};

const firstAllowed = (profile: Parameters<typeof sectionAllowed>[0]) => {
  if (sectionAllowed(profile, "dictionary")) return "/";
  if (sectionAllowed(profile, "documents")) return "/document-creator";
  if (sectionAllowed(profile, "files")) return "/library";
  return "/auth";
};

const ProtectedRoute = ({ children, requireAdmin, requireSection }: Props) => {
  const { loading, session, isAdmin, profile } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!session) return <Navigate to="/auth" replace />;
  if (requireAdmin && !isAdmin) return <Navigate to={firstAllowed(profile)} replace />;
  if (requireSection && !sectionAllowed(profile, requireSection))
    return <Navigate to={firstAllowed(profile)} replace />;
  return <>{children}</>;
};

export default ProtectedRoute;
