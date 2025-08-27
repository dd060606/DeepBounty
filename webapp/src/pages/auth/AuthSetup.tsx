import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2Icon, CheckCircle2, Circle } from "lucide-react";
import ApiClient from "@/utils/api";

export default function AuthSetup() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password validation rules
  const rules = useMemo(() => {
    const length = password.length >= 12;
    const upper = /[A-Z]/.test(password);
    const lower = /[a-z]/.test(password);
    const number = /\d/.test(password);
    const special = /[^A-Za-z0-9]/.test(password);
    return { length, upper, lower, number, special };
  }, [password]);

  // Check if all password rules are satisfied
  const allValid = rules.length && rules.upper && rules.lower && rules.number && rules.special;
  const mismatch = confirm.length > 0 && confirm !== password;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allValid || mismatch) return;
    setLoading(true);
    setError(null);

    ApiClient.post("/setup/password", { password })
      .then(() => {
        navigate("/");
      })
      .catch((error) => {
        setError(t("auth.errors.setupFailed"));
        console.error("Error creating password:", error);
      })
      .finally(() => {
        setLoading(false);
      });
  }

  function RuleItem({ ok, label }: { ok: boolean; label: string }) {
    const Icon = ok ? CheckCircle2 : Circle;
    return (
      <li className="flex items-center gap-2 text-xs">
        <Icon className={ok ? "text-emerald-500" : "text-muted-foreground"} size={16} />
        <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
      </li>
    );
  }

  return (
    <div className="bg-sidebar dark:bg-background flex min-h-svh w-full items-center justify-center px-4 py-12 md:px-6">
      <div className="w-full max-w-lg">
        <div className="border-sidebar-border/60 bg-card/80 supports-[backdrop-filter]:bg-card/60 relative overflow-hidden rounded-xl border p-8 shadow-sm backdrop-blur">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500" />
          <div className="mb-6 space-y-2 text-center">
            <h1 className="text-foreground text-2xl font-semibold tracking-tight">
              {t("setup.title")}
            </h1>
            <p className="text-muted-foreground text-sm">{t("setup.subtitle")}</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-6">
            <div className="grid gap-3">
              <Label htmlFor="password">{t("setup.password")}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("setup.placeholder")}
                  className="pr-16"
                  autoComplete="new-password"
                  required
                  aria-invalid={!allValid && password.length > 0}
                />
                <Button
                  type="button"
                  variant="ghostNoHover"
                  className="absolute inset-y-0 right-0"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? t("auth.hide") : t("auth.show")}
                >
                  {showPassword ? <Eye /> : <EyeOff />}
                </Button>
              </div>

              <div className="rounded-md border p-3">
                <p className="text-muted-foreground mb-2 text-xs font-medium">
                  {t("setup.requirementsTitle")}
                </p>
                <ul className="grid gap-1.5">
                  <RuleItem ok={rules.length} label={t("setup.req.length")} />
                  <RuleItem ok={rules.upper} label={t("setup.req.upper")} />
                  <RuleItem ok={rules.lower} label={t("setup.req.lower")} />
                  <RuleItem ok={rules.number} label={t("setup.req.number")} />
                  <RuleItem ok={rules.special} label={t("setup.req.special")} />
                </ul>
              </div>
            </div>

            <div className="grid gap-3">
              <Label htmlFor="confirm">{t("setup.confirm")}</Label>
              <div className="relative">
                <Input
                  id="confirm"
                  type={showConfirm ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder={t("setup.confirmPlaceholder")}
                  className="pr-16"
                  autoComplete="new-password"
                  required
                  aria-invalid={mismatch}
                />
                <Button
                  type="button"
                  variant="ghostNoHover"
                  className="absolute inset-y-0 right-0"
                  onClick={() => setShowConfirm((s) => !s)}
                  aria-label={showConfirm ? t("auth.hide") : t("auth.show")}
                >
                  {showConfirm ? <Eye /> : <EyeOff />}
                </Button>
              </div>
              {mismatch && (
                <p className="text-destructive text-xs font-medium" role="alert">
                  {t("setup.mismatch")}
                </p>
              )}
              {error && (
                <p className="text-destructive text-xs font-medium" role="alert">
                  {error}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="h-11 w-full"
              disabled={!allValid || mismatch || loading}
            >
              {loading ? <Loader2Icon className="animate-spin" /> : t("setup.submit")}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
