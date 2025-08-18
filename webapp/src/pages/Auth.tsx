import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { getAppName } from "@/utils/config";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Auth() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Si déjà loggé (flag localStorage), rediriger.
  useEffect(() => {
    if (localStorage.getItem("auth_ok") === "1") {
      navigate("/alerts", { replace: true });
    }
  }, [navigate]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const expected = "test";
    // Simule un petit délai UX.
    setTimeout(() => {
      if (password === expected) {
        localStorage.setItem("auth_ok", "1");
        navigate("/alerts", { replace: true });
      } else {
        setError(t("auth.error"));
      }
      setLoading(false);
    }, 400);
  }

  return (
    <div className="bg-sidebar dark:bg-background flex min-h-svh w-full items-center justify-center px-4 py-12 md:px-6">
      <div className="w-full max-w-sm">
        <div className="border-sidebar-border/60 bg-card/80 supports-[backdrop-filter]:bg-card/60 dark:border-sidebar-border/40 relative overflow-hidden rounded-xl border p-8 shadow-sm backdrop-blur">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500" />
          <div className="relative mb-8 space-y-2 text-center">
            <h1 className="text-foreground text-2xl font-semibold tracking-tight">
              {t("auth.login")}
            </h1>
            <p className="text-muted-foreground text-sm">{t("auth.subtitle")}</p>
          </div>
          <form onSubmit={submit} className="relative space-y-5">
            <div className="space-y-2">
              <label className="text-foreground/90 flex items-center gap-2 text-sm font-medium">
                {t("auth.password")}
              </label>
              <div className="relative">
                <Input
                  type={show ? "text" : "password"}
                  required
                  value={password}
                  placeholder={t("auth.placeholder")}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={!!error}
                  className="dark:bg-input/30 pr-16"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="border-border/60 bg-background/70 text-muted-foreground hover:bg-accent hover:text-accent-foreground dark:bg-input/40 dark:hover:bg-input/60 absolute inset-y-0 right-2 my-auto rounded-md border px-2 py-1 text-xs font-medium transition"
                >
                  {show ? t("auth.hide") : t("auth.show")}
                </button>
              </div>
              {error && (
                <p className="text-destructive text-xs font-medium" role="alert">
                  {error}
                </p>
              )}
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="bg-primary hover:bg-primary/90 h-11 w-full cursor-pointer text-sm font-semibold tracking-wide text-white shadow focus-visible:ring-emerald-500/40 disabled:opacity-70"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  {getAppName()}
                </span>
              ) : (
                t("auth.submit")
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
