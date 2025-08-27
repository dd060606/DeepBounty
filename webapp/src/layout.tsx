import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Outlet } from "react-router";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";

export default function Layout() {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  return (
    <SidebarProvider open={isSidebarOpen} onOpenChange={setSidebarOpen}>
      <AppSidebar />
      <SidebarInset>
        {/* SidebarTrigger for mobile */}
        <SidebarTrigger className="m-1 md:hidden" />
        <Outlet />
      </SidebarInset>
      <Toaster position="bottom-center" richColors closeButton />
    </SidebarProvider>
  );
}
