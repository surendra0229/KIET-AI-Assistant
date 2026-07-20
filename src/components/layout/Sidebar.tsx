import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  MessagesSquare,
  Library,
  FileStack,
  BarChart3,
  Settings,
  ChevronsLeft,
  Sparkles,
  ShieldCheck,
  GraduationCap,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

import { useAuth } from "@/contexts/AuthContext";

const allItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["SUPER_ADMIN", "ADMIN"] },
  {
    to: "/chat",
    label: "AI Chat",
    icon: MessagesSquare,
    roles: ["SUPER_ADMIN", "ADMIN", "STUDENT"],
  },
  { to: "/knowledge", label: "Knowledge Base", icon: Library, roles: ["SUPER_ADMIN", "ADMIN"] },
  { to: "/documents", label: "Documents", icon: FileStack, roles: ["SUPER_ADMIN", "ADMIN"] },
  { to: "/analytics", label: "Analytics", icon: BarChart3, roles: ["SUPER_ADMIN", "ADMIN"] },
  {
    to: "/students",
    label: "Student Management",
    icon: GraduationCap,
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  { to: "/admins", label: "Admin Management", icon: ShieldCheck, roles: ["SUPER_ADMIN"] },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["SUPER_ADMIN", "ADMIN"] },
] as const;

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const role = user?.role ?? "STUDENT";
  const items = allItems.filter((i) => (i.roles as readonly string[]).includes(role));

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-300 lg:flex",
        collapsed ? "w-[76px]" : "w-64",
      )}
    >
      <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-4">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-glow text-brand-foreground shadow-lg shadow-brand/20">
          <Sparkles className="h-4.5 w-4.5" strokeWidth={2.5} />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate font-display text-lg leading-none text-sidebar-foreground">
              KIET AI
            </p>
            <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Assistant · v1.0
            </p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        <p
          className={cn(
            "px-3 pb-2 pt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground",
            collapsed && "sr-only",
          )}
        >
          Workspace
        </p>
        <ul className="space-y-1">
          {items.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || pathname.startsWith(to + "/");
            return (
              <li key={to}>
                <Link
                  to={to}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                  )}
                >
                  <Icon
                    className={cn("h-4.5 w-4.5 shrink-0", active && "text-brand")}
                    strokeWidth={active ? 2.4 : 2}
                  />
                  {!collapsed && <span className="truncate">{label}</span>}
                  {!collapsed && active && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-sidebar-border p-3">
        {!collapsed && (
          <div className="mb-3 rounded-xl border border-sidebar-border bg-surface-elevated p-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
              </span>
              <p className="text-xs font-medium text-foreground">RAG engine online</p>
            </div>
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">
              Gemini · ChromaDB · MiniLM
            </p>
          </div>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-sidebar-border bg-surface px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <ChevronsLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
