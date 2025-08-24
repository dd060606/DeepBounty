import ApiClient from "@/utils/api";
import { useEffect } from "react";
import { useNavigate } from "react-router";

export default function Auth() {
  const navigate = useNavigate();

  useEffect(() => {
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
        navigate("/setup", { replace: true });
      });
  }, [navigate]);

  return (
    <div className="bg-sidebar dark:bg-background flex min-h-screen w-full items-center justify-center">
      <div className="border-t-primary border-primary/30 h-12 w-12 animate-spin rounded-full border-4" />
    </div>
  );
}
