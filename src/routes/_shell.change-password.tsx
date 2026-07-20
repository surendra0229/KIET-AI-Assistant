import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { KeyRound, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/services/api";
import { useAuth, defaultRouteForRole } from "@/contexts/AuthContext";

export const Route = createFileRoute("/_shell/change-password")({
  component: ChangePasswordPage,
  head: () => ({
    meta: [
      { title: "Change Password — KIET AI" },
      { name: "description", content: "Change your account password." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "One number", test: (p: string) => /\d/.test(p) },
  { label: "One special character", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

function ChangePasswordPage() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const forced = !!user?.mustChangePassword;

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allRulesPass = RULES.every((r) => r.test(next));
  const canSubmit = current && allRulesPass && next === confirm && !submitting;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError("New password and confirmation do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await api.changePassword(current, next, confirm);
      toast.success("Password updated");
      await refresh();
      navigate({ to: defaultRouteForRole(user?.role), replace: true });
    } catch (err: any) {
      setError(err.message || "Couldn't change password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand/20 to-brand-glow/20 text-brand">
          <KeyRound className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl text-foreground">Change password</h1>
          <p className="text-sm text-muted-foreground">
            {forced
              ? "You must set a new password before continuing."
              : "Use a strong password that you don't reuse elsewhere."}
          </p>
        </div>
      </div>

      {forced && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-brand/40 bg-brand/5 p-3 text-sm text-foreground">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <span>
            Your account is using a temporary password. Please set a new password to activate full
            access.
          </span>
        </div>
      )}

      <form
        onSubmit={submit}
        className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm"
      >
        <PasswordField label="Current password" value={current} onChange={setCurrent} autoFocus />
        <PasswordField label="New password" value={next} onChange={setNext} />
        <PasswordField label="Confirm new password" value={confirm} onChange={setConfirm} />

        <ul className="grid grid-cols-1 gap-1.5 rounded-xl border border-border bg-surface p-3 text-xs sm:grid-cols-2">
          {RULES.map((r) => {
            const ok = r.test(next);
            return (
              <li
                key={r.label}
                className={
                  ok
                    ? "flex items-center gap-2 text-emerald-500"
                    : "flex items-center gap-2 text-muted-foreground"
                }
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> {r.label}
              </li>
            );
          })}
        </ul>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Update password
          </button>
        </div>
      </form>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        type="password"
        required
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
      />
    </label>
  );
}
