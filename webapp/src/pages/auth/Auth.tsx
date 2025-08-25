import { Button } from "@/components/ui/button";
import ApiClient from "@/utils/api";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

export default function Auth() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [serverUnavailable, setServerUnavailable] = useState(false);

  const navigateToProperPage = useCallback(() => {
    setServerUnavailable(false);
    ApiClient.get("/auth/info")
      .then((response) => {
        // Check auth status
        const status = response.data.status;
        if (status === "authenticated") {
          navigate("/alerts", { replace: true });
        } else if (status === "unauthenticated") {
          navigate("/login", { replace: true });
        } else {
          navigate("/setup", { replace: true });
        }
      })
      .catch((err) => {
        console.error("Error while checking setup completion:", err);
        setServerUnavailable(true);
      });
  }, [navigate]);

  useEffect(() => {
    navigateToProperPage();
  }, [navigateToProperPage]);

  return (
    <div className="bg-sidebar dark:bg-background flex min-h-screen w-full items-center justify-center">
      {serverUnavailable ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <p>{t("errors.serverUnavailable")}</p>
          <Button onClick={navigateToProperPage}>{t("errors.retry")}</Button>
        </div>
      ) : (
        <div className="border-t-primary border-primary/30 h-12 w-12 animate-spin rounded-full border-4" />
      )}
    </div>
  );
}
