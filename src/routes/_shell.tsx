import { Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { useAuth, canAccessRoute, defaultRouteForRole } from "@/contexts/AuthContext";

export const Route = createFileRoute("/_shell")({
  component: ShellLayout,
});

function ShellLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login", search: { redirect: pathname }, replace: true });
      return;
    }
    if (user.mustChangePassword && !pathname.startsWith("/change-password")) {
      navigate({ to: "/change-password", replace: true });
      return;
    }
    if (!canAccessRoute(user.role, pathname)) {
      if (user.role === "STUDENT") {
        navigate({ to: defaultRouteForRole(user.role), replace: true });
      } else {
        navigate({ to: "/unauthorized", replace: true });
      }
    }
  }, [loading, user, pathname, navigate]);

  if (loading || !user) {
    return (
      <div className="grid min-h-screen w-full place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
