import { useLocation, Link } from "wouter";
import {
  LayoutDashboard,
  FileSearch,
  AlertTriangle,
  Database,
  FileQuestion,
  GitCompare,
  Shield,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";

const navigationItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Audit Runs",
    url: "/audit-runs",
    icon: FileSearch,
  },
  {
    title: "Findings",
    url: "/findings",
    icon: AlertTriangle,
  },
  {
    title: "Facts Hub",
    url: "/facts",
    icon: Database,
  },
  {
    title: "Question Sets",
    url: "/question-sets",
    icon: FileQuestion,
  },
  {
    title: "Comparison",
    url: "/comparison",
    icon: GitCompare,
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-sidebar-foreground">
              VeriHub Civic
            </span>
            <span className="text-xs text-muted-foreground">
              LLM Audit Dashboard
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => {
                const isActive = location === item.url || 
                  (item.url !== "/" && location.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-2 w-2 rounded-full bg-green-500" />
          <div className="text-xs text-muted-foreground">
            <div>Audited: GPT-4o-mini</div>
            <div>Judge: GPT-4o</div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
