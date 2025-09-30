import { useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Loader2Icon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Link } from "react-router";
import ApiClient from "@/utils/api";

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    ApiClient.post("/auth/login", { password })
      .then(() => {
        navigate("/");
      })
      .catch((error) => {
        if (error.response?.status === 401) {
          setError(t("auth.errors.wrongPassword"));
        } else if (error.response?.status === 429) {
          setError(t("auth.errors.tooManyRequests"));
        } else {
          setError(t("auth.errors.login"));
        }
        console.error("Error logging in:", error);
      })
      .finally(() => {
        setLoading(false);
      });
  }

  return (
    <div className="bg-sidebar dark:bg-background flex min-h-svh w-full items-center justify-center px-4 py-12 md:px-6">
      <div className="w-full max-w-sm">
        <div className="border-sidebar-border/60 bg-card/80 supports-[backdrop-filter]:bg-card/60 relative overflow-hidden rounded-xl border p-8 shadow-sm backdrop-blur">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500" />
          <div className="relative mb-8 space-y-2 text-center">
            <h1 className="text-foreground text-2xl font-semibold tracking-tight">
              {t("auth.login")}
            </h1>
            <p className="text-muted-foreground text-sm">{t("auth.subtitle")}</p>
          </div>
          <form onSubmit={submit} className="relative space-y-5">
            <div className="grid w-full max-w-sm items-center gap-3">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <div className="relative">
                <Input
                  type={show ? "text" : "password"}
                  id="password"
                  value={password}
                  placeholder={t("auth.placeholder")}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={!!error}
                  className="pr-16"
                  required
                />
                <Button
                  type="button"
                  variant="ghostNoHover"
                  onClick={() => setShow((s) => !s)}
                  className="absolute inset-y-0 right-0"
                  aria-label={show ? t("auth.hidePassword") : t("auth.showPassword")}
                >
                  {show ? <Eye /> : <EyeOff />}
                </Button>
              </div>
              {error && (
                <p className="text-destructive text-xs font-medium" role="alert">
                  {error}
                </p>
              )}
              <div className="flex justify-end">
                <Link
                  to="/lost-password"
                  className="text-primary text-xs font-medium hover:underline"
                >
                  {t("auth.lostPassword")}
                </Link>
              </div>
            </div>
            <Button type="submit" disabled={loading} className="h-11 w-full">
              {loading ? <Loader2Icon className="animate-spin" /> : t("auth.submit")}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
