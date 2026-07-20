import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useAuth, defaultRouteForRole } from "@/contexts/AuthContext";

export const Route = createFileRoute("/unauthorized")({
  component: UnauthorizedPage,
  head: () => ({
    meta: [{ title: "Access denied — KIET AI Assistant" }, { name: "robots", content: "noindex" }],
  }),
});

function UnauthorizedPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const home = defaultRouteForRole(user?.role);

  return (
    <div className="grid min-h-screen w-full place-items-center bg-background px-4 text-foreground">
      <div className="max-w-md text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="mt-6 font-display text-3xl">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account role ({user?.role ?? "unknown"}) does not have permission to view this page.
        </p>
        <div className="mt-8 flex justify-center gap-2">
          <Link
            to={home}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Go to your workspace
          </Link>
          <button
            onClick={async () => {
              await logout();
              navigate({ to: "/login", replace: true });
            }}
            className="rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
