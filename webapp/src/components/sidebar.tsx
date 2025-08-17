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
} from "lucide-react";
import { useTranslation } from "react-i18next";

// Logo component for the expanded sidebar
function LogoExpanded() {
  const { toggleSidebar } = useSidebar();
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center">
        <img src="/logo.png" alt="Logo" className="h-15 w-15" />
        <span className="text-md font-semibold tracking-wide">DeepBounty</span>
      </div>
      <AlignRight size={30} className="cursor-pointer" onClick={toggleSidebar} />
    </div>
  );
}

// Logo component for the collapsed sidebar
function LogoCollapsed() {
  const { toggleSidebar } = useSidebar();
  return (
    <div className="flex flex-col items-center gap-2">
      <img src="/logo.png" alt="Logo" className="h-9 w-9" />
      <AlignJustify size={30} className="cursor-pointer" onClick={toggleSidebar} />
    </div>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const { t } = useTranslation();
  const items = [
    {
      title: t("nav.alerts"),
      url: "#alerts",
      icon: CircleAlert,
    },
    {
      title: t("nav.targets"),
      url: "#targets",
      icon: Crosshair,
    },
    {
      title: t("nav.modules"),
      url: "#modules",
      icon: Boxes,
    },
    {
      title: t("nav.settings"),
      url: "#settings",
      icon: Settings,
    },
  ];
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>{state === "expanded" ? <LogoExpanded /> : <LogoCollapsed />}</SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild tooltip={item.title}>
                <a href={item.url} className="flex items-center gap-2">
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Logout">
              <a href="#" className="flex items-center gap-2">
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
