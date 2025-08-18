import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Settings,
  LogOut,
  AlignRight,
  AlignJustify,
  Boxes,
  CircleAlert,
  Crosshair,
  Moon,
  Sun,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "./theme-provider";
import { Link, useLocation, matchPath } from "react-router";

function Logo({ isSidebarOpen }: { isSidebarOpen: boolean }) {
  const { toggleSidebar } = useSidebar();
  const Icon = isSidebarOpen ? AlignRight : AlignJustify;
  return isSidebarOpen ? (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center">
        <img src="/logo.png" alt="Logo" className="h-15 w-15" />
        <span className="text-md font-semibold tracking-wide">DeepBounty</span>
      </div>
      <Icon size={30} className="cursor-pointer" onClick={toggleSidebar} />
    </div>
  ) : (
    <div className="flex flex-col items-center gap-2">
      <img src="/logo.png" alt="Logo" className="h-9 w-9" />
      <Icon size={30} className="cursor-pointer" onClick={toggleSidebar} />
    </div>
  );
}

export function AppSidebar() {
  const { open } = useSidebar();
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { theme, setTheme } = useTheme();
  const items = [
    {
      title: t("nav.alerts"),
      url: "/alerts",
      icon: CircleAlert,
    },
    {
      title: t("nav.targets"),
      url: "/targets",
      icon: Crosshair,
    },
    {
      title: t("nav.modules"),
      url: "/modules",
      icon: Boxes,
    },
    {
      title: t("nav.settings"),
      url: "/settings",
      icon: Settings,
    },
  ];
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Logo isSidebarOpen={open} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {items.map((item) => {
            // Check if the current path matches the item's URL
            const active = !!matchPath({ path: item.url, end: true }, pathname);
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  className={
                    "flex items-center gap-2 " + (active ? "bg-primary hover:bg-primary/90" : "")
                  }
                >
                  <Link to={item.url}>
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link to="/" className="flex items-center gap-2">
                <LogOut className="size-4" />
                <span>{t("nav.logout")}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <button
                className="cursor-pointer"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
                <span>{theme === "dark" ? t("nav.lightMode") : t("nav.darkMode")}</span>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
