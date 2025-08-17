import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { useState } from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <SidebarProvider open={isSidebarOpen} onOpenChange={setSidebarOpen}>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-12 items-center gap-2 border-b px-3 md:px-4">
            {/* Hamburger visible sur mobile et desktop pour basculer */}
            <SidebarTrigger className="md:hidden" />
            <h1 className="text-sm font-semibold">DeepBounty</h1>
          </header>
          <div className="p-4">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </ThemeProvider>
  );
}
