import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Outlet, useNavigate } from "react-router";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import ApiClient from "./utils/api";

export default function Layout() {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();
  // Check auth status
  ApiClient.get("/auth/info").then((res) => {
    if (res.data.status !== "authenticated") {
      // User is not authenticated
      navigate("/login", { replace: true });
    }
  });
  return (
    <SidebarProvider open={isSidebarOpen} onOpenChange={setSidebarOpen}>
      <AppSidebar />
      <SidebarInset>
        {/* SidebarTrigger for mobile */}
        <SidebarTrigger className="m-1 md:hidden" />
        <Outlet />
      </SidebarInset>
      <Toaster position="bottom-center" richColors />
    </SidebarProvider>
  );
}
