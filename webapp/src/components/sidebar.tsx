import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Bell, Box, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
const items = [
  {
    title: "Alerts",
    url: "#alerts",
    icon: Bell,
  },
  {
    title: "Modules",
    url: "#modules",
    icon: Box,
  },
  {
    title: "Settings",
    url: "#settings",
    icon: Settings,
  },
];

function Logo() {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <div className="from-primary to-primary/70 text-primary-foreground flex size-8 items-center justify-center rounded-md bg-gradient-to-br font-semibold">
        DB
      </div>
      <span className="text-sm font-semibold tracking-wide">DeepBounty</span>
    </div>
  );
}
export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader>
        <Logo />
        <SidebarSeparator className="my-1" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <a href={item.url}>
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a href="#">
                <LogOut className="size-4" />
                <span>Logout</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
