import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Code } from "lucide-react";

export default function LostPassword() {
  const { t } = useTranslation();
  return (
    <div className="bg-sidebar dark:bg-background flex min-h-svh w-full items-center justify-center px-4 py-12 md:px-6">
      <div className="w-full max-w-lg">
        <div className="border-sidebar-border/60 bg-card/80 supports-[backdrop-filter]:bg-card/60 relative overflow-hidden rounded-xl border p-8 shadow-sm backdrop-blur">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500" />
          <div className="mb-6 space-y-2 text-center">
            <h1 className="text-foreground text-2xl font-semibold tracking-tight">
              {t("lostPassword.title")}
            </h1>
            <p className="text-muted-foreground text-sm">{t("lostPassword.subtitle")}</p>
          </div>
          <div className="space-y-5 text-sm leading-relaxed">
            <Separator className="my-2" />
            <p className="font-medium">{t("lostPassword.stepsTitle")}</p>
            <ol className="list-decimal space-y-2 pl-5">
              <li>{t("lostPassword.step1")}</li>
              <li>{t("lostPassword.step2")}</li>
              <li>
                {t("lostPassword.step3")}
                <pre className="bg-muted mt-2 overflow-auto rounded-md p-3 text-xs">
                  {`{
  "password": ""
}`}
                </pre>
              </li>
              <li>{t("lostPassword.step4")}</li>
              <li>{t("lostPassword.step5")}</li>
            </ol>
            <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
              <Code className="mt-0.5 size-4 shrink-0" />
              <p>{t("lostPassword.note")}</p>
            </div>
          </div>
          <div className="mt-8 flex justify-center">
            <Button asChild variant="outline" size="sm">
              <Link to="/login">{t("lostPassword.back")}</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
