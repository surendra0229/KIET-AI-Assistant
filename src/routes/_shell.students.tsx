import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GraduationCap,
  Plus,
  Search,
  Upload,
  Download,
  FileSpreadsheet,
  MoreHorizontal,
  KeyRound,
  Power,
  Trash2,
  Pencil,
  X,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import {
  api,
  type StudentRecord,
  type StudentStatus,
  type StudentPayload,
  type StudentImportPreview,
} from "@/services/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/students")({
  component: StudentsPage,
  head: () => ({
    meta: [
      { title: "Student Management — College AI" },
      { name: "description", content: "Manage student accounts, bulk import & export." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const STATUS_STYLES: Record<StudentStatus, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/30",
  INACTIVE: "bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/30",
  DISABLED: "bg-destructive/10 text-destructive ring-1 ring-destructive/30",
  DELETED: "bg-muted text-muted-foreground ring-1 ring-border",
};

const STATUS_OPTIONS: StudentStatus[] = ["ACTIVE", "INACTIVE", "DISABLED"];
const PAGE_SIZE = 25;

function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return "—";
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const EMPTY_FORM: StudentPayload = {
  rollNumber: "",
  fullName: "",
  email: "",
  phone: "",
  department: "",
  branch: "",
  year: "",
  gender: "",
  status: "ACTIVE",
};

function StudentsPage() {
  const [rows, setRows] = useState<StudentRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<{
    department: string[];
    branch: string[];
    year: string[];
  }>({ department: [], branch: [], year: [] });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [branch, setBranch] = useState("");
  const [year, setYear] = useState("");
  const [status, setStatus] = useState<StudentStatus | "">("");
  const [page, setPage] = useState(1);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const [showForm, setShowForm] = useState<{
    mode: "create" | "edit";
    data: StudentPayload;
    id?: string;
  } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<StudentRecord | null>(null);
  const [resetInfo, setResetInfo] = useState<{ email: string; password: string } | null>(null);
  const [showImport, setShowImport] = useState(false);

  const filters = useMemo(
    () => ({ search, department, branch, year, status }),
    [search, department, branch, year, status],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listStudents({
        search,
        department,
        branch,
        year,
        status,
        page,
        pageSize: PAGE_SIZE,
        includeDeleted: status === "DELETED",
      });
      setRows(data.items);
      setTotal(data.total);
      setFacets(data.facets);
    } catch (e: any) {
      toast.error("Couldn't load students", { description: e.message });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [search, department, branch, year, status, page]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    setPage(1);
  }, [search, department, branch, year, status]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const toggleSelectAll = () => {
    if (selection.size === rows.length && rows.length > 0) setSelection(new Set());
    else setSelection(new Set(rows.map((r) => r.studentId)));
  };
  const toggleSelect = (id: string) => {
    setSelection((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await api.deleteStudent(confirmDelete.studentId);
      toast.success("Student deleted");
      setConfirmDelete(null);
      reload();
    } catch (e: any) {
      toast.error("Delete failed", { description: e.message });
    }
  };

  const handleStatus = async (s: StudentRecord, next: StudentStatus) => {
    try {
      await api.setStudentStatus(s.studentId, next);
      toast.success(`Status set to ${next}`);
      reload();
    } catch (e: any) {
      toast.error("Update failed", { description: e.message });
    }
  };

  const handleReset = async (s: StudentRecord) => {
    try {
      const res = await api.resetStudentPassword(s.studentId);
      setResetInfo({ email: s.email, password: res.defaultPassword });
    } catch (e: any) {
      toast.error("Reset failed", { description: e.message });
    }
  };

  const handleExport = async (mode: "all" | "filtered" | "selected") => {
    try {
      const body: { ids?: string[]; filters?: Record<string, unknown> } = {};
      if (mode === "selected") body.ids = Array.from(selection);
      else if (mode === "filtered") body.filters = filters;
      const blob = await api.exportStudents(body);
      downloadBlob(blob, `students_${mode}_${Date.now()}.xlsx`);
      toast.success("Export ready");
    } catch (e: any) {
      toast.error("Export failed", { description: e.message });
    }
  };

  const handleTemplate = async () => {
    try {
      const blob = await api.studentTemplate();
      downloadBlob(blob, "students_template.xlsx");
    } catch (e: any) {
      toast.error("Template download failed", { description: e.message });
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand/20 to-brand-glow/20 text-brand">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl text-foreground">Student Management</h1>
            <p className="text-sm text-muted-foreground">
              {total.toLocaleString()} student{total === 1 ? "" : "s"} · default password is their
              roll number
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleTemplate}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-elevated"
          >
            <FileSpreadsheet className="h-4 w-4" /> Template
          </button>
          <div className="relative">
            <details className="group">
              <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-elevated">
                <Download className="h-4 w-4" /> Export
              </summary>
              <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
                <button
                  onClick={() => handleExport("all")}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-elevated"
                >
                  All students
                </button>
                <button
                  onClick={() => handleExport("filtered")}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-elevated"
                >
                  Current filter ({total})
                </button>
                <button
                  onClick={() => handleExport("selected")}
                  disabled={selection.size === 0}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-elevated disabled:opacity-50"
                >
                  Selected ({selection.size})
                </button>
              </div>
            </details>
          </div>
          <button
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-elevated"
          >
            <Upload className="h-4 w-4" /> Bulk Import
          </button>
          <button
            onClick={() => setShowForm({ mode: "create", data: { ...EMPTY_FORM } })}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:bg-brand-glow"
          >
            <Plus className="h-4 w-4" /> Add Student
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 grid gap-2 rounded-2xl border border-border bg-surface p-3 md:grid-cols-6">
        <div className="relative md:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email or roll number"
            className="w-full rounded-xl border border-border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:border-brand"
          />
        </div>
        <Select
          value={department}
          onChange={setDepartment}
          options={facets.department}
          placeholder="Department"
        />
        <Select value={branch} onChange={setBranch} options={facets.branch} placeholder="Branch" />
        <Select value={year} onChange={setYear} options={facets.year} placeholder="Year" />
        <Select
          value={status}
          onChange={(v) => setStatus(v as StudentStatus | "")}
          options={["ACTIVE", "INACTIVE", "DISABLED", "DELETED"]}
          placeholder="Status"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-surface-elevated text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && selection.size === rows.length}
                    onChange={toggleSelectAll}
                    className="h-4 w-4"
                  />
                </th>
                <th className="px-3 py-3 text-left">Roll</th>
                <th className="px-3 py-3 text-left">Name</th>
                <th className="px-3 py-3 text-left">Email</th>
                <th className="px-3 py-3 text-left">Department / Branch</th>
                <th className="px-3 py-3 text-left">Year</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-left">Last Login</th>
                <th className="w-12 px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                    No students match your filters.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.studentId} className="hover:bg-surface-elevated/40">
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selection.has(r.studentId)}
                        onChange={() => toggleSelect(r.studentId)}
                        className="h-4 w-4"
                      />
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs">{r.rollNumber}</td>
                    <td className="px-3 py-2.5 font-medium text-foreground">{r.fullName}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.email}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {r.department || "—"}
                      {r.branch ? ` · ${r.branch}` : ""}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.year || "—"}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold",
                          STATUS_STYLES[r.status],
                        )}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{fmt(r.lastLogin)}</td>
                    <td className="px-3 py-2.5">
                      <div className="relative">
                        <button
                          onClick={() =>
                            setMenuOpen((c) => (c === r.studentId ? null : r.studentId))
                          }
                          className="grid h-8 w-8 place-items-center rounded-lg hover:bg-surface-elevated"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {menuOpen === r.studentId && (
                          <div
                            onMouseLeave={() => setMenuOpen(null)}
                            className="absolute right-0 z-10 mt-1 w-48 overflow-hidden rounded-xl border border-border bg-popover shadow-lg"
                          >
                            <MenuItem
                              icon={Pencil}
                              label="Edit"
                              onClick={() => {
                                setMenuOpen(null);
                                setShowForm({
                                  mode: "edit",
                                  id: r.studentId,
                                  data: {
                                    rollNumber: r.rollNumber,
                                    fullName: r.fullName,
                                    email: r.email,
                                    phone: r.phone,
                                    department: r.department,
                                    branch: r.branch,
                                    year: r.year,
                                    gender: r.gender,
                                    status: r.status === "DELETED" ? "ACTIVE" : r.status,
                                  },
                                });
                              }}
                            />
                            <MenuItem
                              icon={KeyRound}
                              label="Reset password"
                              onClick={() => {
                                setMenuOpen(null);
                                handleReset(r);
                              }}
                            />
                            {r.status !== "DISABLED" ? (
                              <MenuItem
                                icon={Power}
                                label="Disable"
                                onClick={() => {
                                  setMenuOpen(null);
                                  handleStatus(r, "DISABLED");
                                }}
                              />
                            ) : (
                              <MenuItem
                                icon={Power}
                                label="Enable"
                                onClick={() => {
                                  setMenuOpen(null);
                                  handleStatus(r, "ACTIVE");
                                }}
                              />
                            )}
                            <MenuItem
                              icon={Trash2}
                              label="Delete"
                              danger
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
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <span>
            Page {page} of {totalPages} · {total} record{total === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 hover:bg-surface-elevated disabled:opacity-50"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 hover:bg-surface-elevated disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Form modal */}
      {showForm && (
        <StudentFormModal
          mode={showForm.mode}
          initial={showForm.data}
          onClose={() => setShowForm(null)}
          onSave={async (payload) => {
            try {
              if (showForm.mode === "create") {
                await api.createStudent(payload);
                toast.success("Student added");
              } else if (showForm.id) {
                await api.updateStudent(showForm.id, payload);
                toast.success("Student updated");
              }
              setShowForm(null);
              reload();
            } catch (e: any) {
              toast.error(showForm.mode === "create" ? "Add failed" : "Update failed", {
                description: e.message,
              });
            }
          }}
        />
      )}

      {/* Delete modal */}
      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(null)}>
          <div className="mb-4 flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg text-foreground">Delete student?</h2>
              <p className="text-sm text-muted-foreground">
                {confirmDelete.fullName} ({confirmDelete.rollNumber}) will be marked as DELETED.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setConfirmDelete(null)}
              className="rounded-xl border border-border bg-surface px-4 py-2 text-sm hover:bg-surface-elevated"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="rounded-xl bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:opacity-90"
            >
              Delete
            </button>
          </div>
        </Modal>
      )}

      {/* Reset password modal */}
      {resetInfo && (
        <Modal onClose={() => setResetInfo(null)}>
          <div className="mb-3 flex items-center gap-2 text-emerald-500">
            <CheckCircle2 className="h-5 w-5" />
            <h2 className="font-display text-lg text-foreground">Password reset</h2>
          </div>
          <p className="mb-3 text-sm text-muted-foreground">
            {resetInfo.email} — new password is their roll number. They must change it on next
            login.
          </p>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-elevated px-3 py-2 font-mono text-sm">
            <span className="flex-1 truncate">{resetInfo.password}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(resetInfo.password);
                toast.success("Copied");
              }}
              className="rounded-lg p-1.5 hover:bg-surface"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => setResetInfo(null)}
              className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground"
            >
              Done
            </button>
          </div>
        </Modal>
      )}

      {/* Bulk import modal */}
      {showImport && (
        <BulkImportModal
          onClose={() => setShowImport(false)}
          onDone={() => {
            setShowImport(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

// ─── Bits ─────────────────────────────────────────────────────────────────
function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: any;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-elevated",
        danger && "text-destructive",
      )}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-border bg-popover p-6 shadow-2xl"
      >
        {children}
      </div>
    </div>
  );
}

function StudentFormModal({
  mode,
  initial,
  onClose,
  onSave,
}: {
  mode: "create" | "edit";
  initial: StudentPayload;
  onClose: () => void;
  onSave: (data: StudentPayload) => Promise<void>;
}) {
  const [form, setForm] = useState<StudentPayload>(initial);
  const [busy, setBusy] = useState(false);
  const set =
    (k: keyof StudentPayload) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim() || !form.rollNumber.trim() || !form.email.trim()) {
      toast.error("Full name, roll number and email are required");
      return;
    }
    setBusy(true);
    try {
      await onSave(form);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg text-foreground">
          {mode === "create" ? "Add Student" : "Edit Student"}
        </h2>
        <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-surface-elevated">
          <X className="h-4 w-4" />
        </button>
      </div>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <Field label="Full Name *">
          <input required value={form.fullName} onChange={set("fullName")} className={inputCls} />
        </Field>
        <Field label="Roll Number *">
          <input
            required
            value={form.rollNumber}
            onChange={set("rollNumber")}
            className={inputCls}
          />
        </Field>
        <Field label="Email *" full>
          <input
            required
            type="email"
            value={form.email}
            onChange={set("email")}
            className={inputCls}
          />
        </Field>
        <Field label="Phone">
          <input value={form.phone ?? ""} onChange={set("phone")} className={inputCls} />
        </Field>
        <Field label="Gender">
          <select value={form.gender ?? ""} onChange={set("gender")} className={inputCls}>
            <option value="">—</option>
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
          </select>
        </Field>
        <Field label="Department">
          <input value={form.department ?? ""} onChange={set("department")} className={inputCls} />
        </Field>
        <Field label="Branch">
          <input value={form.branch ?? ""} onChange={set("branch")} className={inputCls} />
        </Field>
        <Field label="Year">
          <input value={form.year ?? ""} onChange={set("year")} className={inputCls} />
        </Field>
        <Field label="Status" full>
          <select value={form.status ?? "ACTIVE"} onChange={set("status")} className={inputCls}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <div className="col-span-2 mt-2 flex items-center justify-between">
          {mode === "create" && (
            <p className="text-xs text-muted-foreground">
              Default password will be the roll number. Student must change it on first login.
            </p>
          )}
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border bg-surface px-4 py-2 text-sm hover:bg-surface-elevated"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:bg-brand-glow disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "create" ? "Add Student" : "Save changes"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

const inputCls =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand";

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={cn("flex flex-col gap-1", full && "col-span-2")}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function BulkImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<StudentImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const doPreview = async (f: File) => {
    setBusy(true);
    try {
      const p = await api.previewStudentImport(f);
      setPreview(p);
    } catch (e: any) {
      toast.error("Preview failed", { description: e.message });
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    if (!preview) return;
    setImporting(true);
    try {
      const res = await api.bulkImportStudents(preview.toImport as Record<string, unknown>[]);
      setResult(res.counts);
      toast.success(`Imported ${res.counts.imported} · Skipped ${res.counts.skipped}`);
    } catch (e: any) {
      toast.error("Import failed", { description: e.message });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-popover p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg text-foreground">Bulk Import Students</h2>
            <p className="text-xs text-muted-foreground">
              Upload an .xlsx or .xls file. Download the template above for the correct format.
            </p>
          </div>
          <button
            onClick={result ? onDone : onClose}
            className="rounded-lg p-1.5 hover:bg-surface-elevated"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!preview && !result && (
          <div
            onClick={() => inputRef.current?.click()}
            className="grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-border bg-surface p-10 text-center hover:border-brand"
          >
            <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-foreground">
              {file ? file.name : "Click to choose an Excel file"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Required columns: Roll Number, Full Name, Email
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setFile(f);
                  doPreview(f);
                }
              }}
            />
            {busy && <Loader2 className="mt-3 h-5 w-5 animate-spin text-muted-foreground" />}
          </div>
        )}

        {preview && !result && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Stat label="Total rows" value={preview.totalRows} />
              <Stat label="To import" value={preview.toImport.length} tone="ok" />
              <Stat
                label="Duplicates"
                value={preview.duplicatesInFile.length + preview.existingInDb.length}
                tone="warn"
              />
              <Stat label="Invalid" value={preview.invalidRows.length} tone="bad" />
            </div>

            <PreviewList
              title={`Ready to import (${preview.toImport.length})`}
              rows={preview.toImport.slice(0, 100).map((r) => ({
                label: `${r.rollNumber} — ${r.fullName} — ${r.email}`,
              }))}
              tone="ok"
            />
            {preview.existingInDb.length > 0 && (
              <PreviewList
                title={`Already in database (${preview.existingInDb.length})`}
                rows={preview.existingInDb.slice(0, 50).map((r) => ({
                  label: `Row ${r.row}: ${r.data.rollNumber ?? ""} · ${r.data.email ?? ""} — ${r.reason}`,
                }))}
                tone="warn"
              />
            )}
            {preview.duplicatesInFile.length > 0 && (
              <PreviewList
                title={`Duplicates within file (${preview.duplicatesInFile.length})`}
                rows={preview.duplicatesInFile.slice(0, 50).map((r) => ({
                  label: `Row ${r.row}: ${r.data.rollNumber ?? ""} · ${r.data.email ?? ""}`,
                }))}
                tone="warn"
              />
            )}
            {preview.invalidRows.length > 0 && (
              <PreviewList
                title={`Invalid rows (${preview.invalidRows.length})`}
                rows={preview.invalidRows.slice(0, 50).map((r) => ({
                  label: `Row ${r.row}: ${r.errors.join(", ")}`,
                }))}
                tone="bad"
              />
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setPreview(null);
                  setFile(null);
                }}
                className="rounded-xl border border-border bg-surface px-4 py-2 text-sm hover:bg-surface-elevated"
              >
                Choose different file
              </button>
              <button
                onClick={doImport}
                disabled={importing || preview.toImport.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:bg-brand-glow disabled:opacity-50"
              >
                {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                Import {preview.toImport.length} students
              </button>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-4 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-display text-xl text-foreground">Import complete</h3>
              <p className="text-sm text-muted-foreground">
                {result.imported} imported · {result.skipped} skipped
              </p>
            </div>
            <button
              onClick={onDone}
              className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn" | "bad";
}) {
  const toneCls =
    tone === "ok"
      ? "text-emerald-500"
      : tone === "warn"
        ? "text-amber-500"
        : tone === "bad"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-1 text-2xl font-display", toneCls)}>{value}</p>
    </div>
  );
}

function PreviewList({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: { label: string }[];
  tone: "ok" | "warn" | "bad";
}) {
  if (rows.length === 0) return null;
  const dot =
    tone === "ok" ? "bg-emerald-500" : tone === "warn" ? "bg-amber-500" : "bg-destructive";
  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs font-semibold text-foreground">
        <span className={cn("h-2 w-2 rounded-full", dot)} />
        {title}
      </div>
      <ul className="max-h-40 overflow-y-auto divide-y divide-border text-xs">
        {rows.map((r, i) => (
          <li key={i} className="px-3 py-1.5 text-muted-foreground">
            {r.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
