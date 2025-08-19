import { useEffect } from "react";
import { useNavigate } from "react-router";

export default function Auth() {
  const navigate = useNavigate();

  useEffect(() => {
    // Simulate authentication
    setTimeout(() => {
      navigate("/login");
    }, 2000);
  }, [navigate]);

  return (
    <div className="bg-sidebar dark:bg-background flex min-h-screen w-full items-center justify-center">
      <div className="border-t-primary border-primary/30 h-12 w-12 animate-spin rounded-full border-4" />
    </div>
  );
}
