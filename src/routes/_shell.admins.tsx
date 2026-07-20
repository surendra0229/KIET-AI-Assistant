import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ShieldCheck,
  Plus,
  Search,
  MoreHorizontal,
  Copy,
  KeyRound,
  Power,
  Trash2,
  Loader2,
  X,
  AlertTriangle,
  CheckCircle2,
  UserCog,
} from "lucide-react";
import { toast } from "sonner";
import { api, type AdminRecord, type AdminStatus, type CreateAdminPayload } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/admins")({
  component: AdminsPage,
  head: () => ({
    meta: [
      { title: "Admin Management — KIET AI" },
      { name: "description", content: "Manage administrator accounts, roles and access." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const STATUS_STYLES: Record<AdminStatus, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/30",
  INACTIVE: "bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/30",
  DISABLED: "bg-destructive/10 text-destructive ring-1 ring-destructive/30",
};

const PAGE_SIZE = 10;

type SortKey = "createdAt" | "lastLogin" | "name";

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  } catch {
    return "—";
  }
}

function AdminsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<AdminRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState<string>("");
  const [status, setStatus] = useState<AdminStatus | "">("");
  const [sortBy, setSortBy] = useState<SortKey>("createdAt");
  const [page, setPage] = useState(1);

  const [showCreate, setShowCreate] = useState(false);
  const [showTempPassword, setShowTempPassword] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminRecord | null>(null);
  const [editing, setEditing] = useState<AdminRecord | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const data = await api.listAdmins();
      setRows(data);
    } catch (e: any) {
      toast.error("Couldn't load admins", { description: e.message });
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const departments = useMemo(() => {
    const s = new Set<string>();
    (rows ?? []).forEach((r) => r.department && s.add(r.department));
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows ?? [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          (r.department ?? "").toLowerCase().includes(q),
      );
    }
    if (department) list = list.filter((r) => r.department === department);
    if (status) list = list.filter((r) => r.status === status);
    list = [...list].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      const av = (sortBy === "createdAt" ? a.createdAt : a.lastLogin) ?? "";
      const bv = (sortBy === "createdAt" ? b.createdAt : b.lastLogin) ?? "";
      return bv.localeCompare(av);
    });
    return list;
  }, [rows, search, department, status, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, department, status, sortBy]);

  const stats = useMemo(() => {
    const list = rows ?? [];
    return {
      total: list.filter((r) => r.role === "ADMIN").length,
      active: list.filter((r) => r.status === "ACTIVE" && r.role === "ADMIN").length,
      disabled: list.filter((r) => r.status !== "ACTIVE" && r.role === "ADMIN").length,
    };
  }, [rows]);

  async function handleStatusChange(record: AdminRecord, next: AdminStatus) {
    try {
      const updated = await api.setAdminStatus(record.userId, next);
      setRows((prev) => (prev ?? []).map((r) => (r.userId === updated.userId ? updated : r)));
      toast.success(`${updated.name} is now ${next.toLowerCase()}`);
    } catch (e: any) {
      toast.error("Couldn't update status", { description: e.message });
    }
  }

  async function handleResetPassword(record: AdminRecord) {
    try {
      const res = await api.resetAdminPassword(record.userId);
      setShowTempPassword({ email: record.email, password: res.temporaryPassword });
      toast.success("Temporary password generated");
    } catch (e: any) {
      toast.error("Couldn't reset password", { description: e.message });
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await api.deleteAdmin(confirmDelete.userId);
      setRows((prev) => (prev ?? []).filter((r) => r.userId !== confirmDelete.userId));
      toast.success(`${confirmDelete.name} deleted`);
      setConfirmDelete(null);
    } catch (e: any) {
      toast.error("Couldn't delete admin", { description: e.message });
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-brand" /> Super Admin
          </div>
          <h1 className="font-display text-3xl text-foreground">Admin Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create, disable and manage administrator accounts for{" "}
            {user?.department || "your workspace"}.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5"
        >
          <Plus className="h-4 w-4" /> Create Admin
        </button>
      </div>

      {/* Stat strip */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Total admins", value: stats.total, tone: "text-foreground" },
          { label: "Active", value: stats.active, tone: "text-emerald-500" },
          { label: "Disabled / inactive", value: stats.disabled, tone: "text-amber-500" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {s.label}
            </p>
            <p className={cn("mt-1 font-display text-2xl", s.tone)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or department"
            className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:border-brand focus:outline-none"
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as AdminStatus | "")}
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:border-brand focus:outline-none"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="DISABLED">Disabled</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:border-brand focus:outline-none"
        >
          <option value="createdAt">Sort: newest</option>
          <option value="lastLogin">Sort: last login</option>
          <option value="name">Sort: alphabetical</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-elevated/60 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Designation</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last login</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/60">
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className="px-4 py-4">
                        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))}

              {!loading && pageRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <UserCog className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
                    <p className="font-display text-lg text-foreground">No administrators yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Invite your first admin to help manage the workspace.
                    </p>
                    <button
                      onClick={() => setShowCreate(true)}
                      className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground"
                    >
                      <Plus className="h-4 w-4" /> Create Admin
                    </button>
                  </td>
                </tr>
              )}

              {!loading &&
                pageRows.map((r) => (
                  <tr
                    key={r.userId}
                    className="border-b border-border/60 last:border-b-0 hover:bg-surface/40"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-brand/20 to-brand-glow/20 text-xs font-medium text-brand">
                          {r.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{r.name}</p>
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                            {r.role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.department || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.designation || "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                          STATUS_STYLES[r.status] ?? STATUS_STYLES.ACTIVE,
                        )}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(r.lastLogin)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(r.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="relative inline-block">
                        <button
                          onClick={() => setMenuOpen(menuOpen === r.userId ? null : r.userId)}
                          disabled={r.role === "SUPER_ADMIN"}
                          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-surface hover:text-foreground disabled:opacity-40"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {menuOpen === r.userId && (
                          <div
                            onMouseLeave={() => setMenuOpen(null)}
                            className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-xl"
                          >
                            <MenuItem
                              icon={UserCog}
                              label="Edit details"
                              onClick={() => {
                                setEditing(r);
                                setMenuOpen(null);
                              }}
                            />
                            <MenuItem
                              icon={KeyRound}
                              label="Reset password"
                              onClick={() => {
                                setMenuOpen(null);
                                handleResetPassword(r);
                              }}
                            />
                            {r.status === "ACTIVE" ? (
                              <MenuItem
                                icon={Power}
                                label="Disable"
                                onClick={() => {
                                  setMenuOpen(null);
                                  handleStatusChange(r, "DISABLED");
                                }}
                              />
                            ) : (
                              <MenuItem
                                icon={CheckCircle2}
                                label="Enable"
                                onClick={() => {
                                  setMenuOpen(null);
                                  handleStatusChange(r, "ACTIVE");
                                }}
                              />
                            )}
                            <div className="my-1 h-px bg-border" />
                            <MenuItem
                              icon={Trash2}
                              label="Delete admin"
                              destructive
                              onClick={() => {
                                setMenuOpen(null);
                                setConfirmDelete(r);
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > 0 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <p>
              Showing <span className="text-foreground">{(page - 1) * PAGE_SIZE + 1}</span>–
              <span className="text-foreground">{Math.min(page * PAGE_SIZE, filtered.length)}</span>{" "}
              of <span className="text-foreground">{filtered.length}</span>
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-8 rounded-lg border border-border px-3 text-xs hover:bg-surface disabled:opacity-40"
              >
                Previous
              </button>
              <span className="px-2">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-8 rounded-lg border border-border px-3 text-xs hover:bg-surface disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateAdminModal
          onClose={() => setShowCreate(false)}
          onCreated={(admin, temporaryPassword) => {
            setRows((prev) => [admin, ...(prev ?? [])]);
            setShowCreate(false);
            setShowTempPassword({ email: admin.email, password: temporaryPassword });
          }}
        />
      )}

      {editing && (
        <EditAdminModal
          record={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setRows((prev) => (prev ?? []).map((r) => (r.userId === updated.userId ? updated : r)));
            setEditing(null);
          }}
        />
      )}

      {showTempPassword && (
        <TempPasswordModal
          email={showTempPassword.email}
          password={showTempPassword.password}
          onClose={() => setShowTempPassword(null)}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete ${confirmDelete.name}?`}
          description="This admin will lose access immediately. Uploaded documents and chat history will be preserved."
          confirmLabel="Delete admin"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  destructive,
}: {
  icon: any;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors",
        destructive
          ? "text-destructive hover:bg-destructive/10"
          : "text-foreground hover:bg-surface",
      )}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

// ── Create modal ─────────────────────────────────────────────────────────
function CreateAdminModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (admin: AdminRecord, temporaryPassword: string) => void;
}) {
  const [form, setForm] = useState<CreateAdminPayload>({
    name: "",
    email: "",
    department: "",
    designation: "",
    phone: "",
  });
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.createAdmin(form);
      toast.success("Admin created");
      onCreated(res.admin, res.temporaryPassword);
    } catch (err: any) {
      toast.error("Couldn't create admin", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      onClose={onClose}
      title="Create Administrator"
      subtitle="A strong temporary password is generated automatically."
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <ModalField label="Full name" required>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
              placeholder="Ada Lovelace"
            />
          </ModalField>
          <ModalField label="Email" required>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input"
              placeholder="admin@college.edu"
            />
          </ModalField>
          <ModalField label="Department">
            <input
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              className="input"
              placeholder="Computer Science"
            />
          </ModalField>
          <ModalField label="Designation">
            <input
              value={form.designation}
              onChange={(e) => setForm({ ...form, designation: e.target.value })}
              className="input"
              placeholder="HOD"
            />
          </ModalField>
          <ModalField label="Phone">
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="input"
              placeholder="+1 555 0100"
            />
          </ModalField>
          <ModalField label="Role">
            <input disabled value="Administrator" className="input opacity-70" />
          </ModalField>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-border px-4 text-sm text-foreground hover:bg-surface"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Admin
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditAdminModal({
  record,
  onClose,
  onSaved,
}: {
  record: AdminRecord;
  onClose: () => void;
  onSaved: (admin: AdminRecord) => void;
}) {
  const [form, setForm] = useState({
    name: record.name,
    department: record.department,
    designation: record.designation,
    phone: record.phone,
  });
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const updated = await api.updateAdmin(record.userId, form);
      toast.success("Admin updated");
      onSaved(updated);
    } catch (err: any) {
      toast.error("Couldn't update admin", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} title={`Edit ${record.name}`} subtitle={record.email}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <ModalField label="Full name" required>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
            />
          </ModalField>
          <ModalField label="Department">
            <input
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              className="input"
            />
          </ModalField>
          <ModalField label="Designation">
            <input
              value={form.designation}
              onChange={(e) => setForm({ ...form, designation: e.target.value })}
              className="input"
            />
          </ModalField>
          <ModalField label="Phone">
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="input"
            />
          </ModalField>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-border px-4 text-sm text-foreground hover:bg-surface"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </button>
        </div>
      </form>
    </Modal>
  );
}

function TempPasswordModal({
  email,
  password,
  onClose,
}: {
  email: string;
  password: string;
  onClose: () => void;
}) {
  return (
    <Modal
      onClose={onClose}
      title="Temporary password"
      subtitle="Copy this now. Email delivery is not yet integrated — this password will not be shown again."
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-surface p-3 text-sm">
          <p className="text-muted-foreground">Recipient</p>
          <p className="font-medium text-foreground">{email}</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-brand/40 bg-brand/5 p-3 font-mono text-sm">
          <span className="flex-1 select-all text-foreground">{password}</span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(password);
              toast.success("Password copied");
            }}
            className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground"
          >
            <Copy className="h-3.5 w-3.5" /> Copy
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          The admin will be required to change this password on first sign-in.
        </p>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="h-10 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal onClose={onCancel} title={title} subtitle={description} tone="destructive">
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="h-10 rounded-xl border border-border px-4 text-sm text-foreground hover:bg-surface"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-destructive px-4 text-sm font-medium text-destructive-foreground"
        >
          <Trash2 className="h-4 w-4" /> {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

function Modal({
  title,
  subtitle,
  children,
  onClose,
  tone,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  tone?: "destructive";
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between border-b border-border p-5">
          <div className="flex items-start gap-3">
            {tone === "destructive" ? (
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-destructive/10 text-destructive">
                <AlertTriangle className="h-4.5 w-4.5" />
              </div>
            ) : (
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand/10 text-brand">
                <ShieldCheck className="h-4.5 w-4.5" />
              </div>
            )}
            <div>
              <h2 className="font-display text-lg text-foreground">{title}</h2>
              {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-surface hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
      <style>{`.input{height:2.5rem;width:100%;border-radius:0.75rem;border:1px solid hsl(var(--border));background:hsl(var(--background));padding:0 0.875rem;font-size:0.875rem;color:hsl(var(--foreground));outline:none}.input:focus{border-color:hsl(var(--brand));box-shadow:0 0 0 2px hsl(var(--brand)/0.2)}`}</style>
    </div>
  );
}

function ModalField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </span>
      {children}
    </label>
  );
}
