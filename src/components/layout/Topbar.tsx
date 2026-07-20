import { Bell, LogOut, Moon, Search, Sun } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function roleLabel(role: string | undefined): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "Super Admin";
    case "ADMIN":
      return "Admin";
    case "STUDENT":
      return "Student";
    default:
      return "Member";
  }
}

export function Topbar() {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate({ to: "/login", replace: true });
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-5 backdrop-blur-xl">
      <div className="relative flex-1 max-w-xl">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search documents, chats, settings…"
          className="h-10 w-full rounded-xl border border-border bg-surface pl-10 pr-16 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded-md border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-block">
          ⌘ K
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-surface text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <button
          aria-label="Notifications"
          className="relative grid h-10 w-10 place-items-center rounded-xl border border-border bg-surface text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-brand" />
        </button>
        <div className="ml-2 flex items-center gap-2.5 rounded-xl border border-border bg-surface py-1.5 pl-1.5 pr-3">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-brand text-brand-foreground text-xs font-semibold">
              {initials(user?.name ?? "?")}
            </AvatarFallback>
          </Avatar>
          <div className="hidden text-left sm:block">
            <p className="text-xs font-medium leading-tight text-foreground">
              {user?.name ?? "Guest"}
            </p>
            <p className="font-mono text-[10px] text-muted-foreground">{roleLabel(user?.role)}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          aria-label="Sign out"
          title="Sign out"
          className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-surface text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
