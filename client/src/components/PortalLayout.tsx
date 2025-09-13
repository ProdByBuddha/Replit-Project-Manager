import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Link } from "wouter";
import { Shield, Clock, Bell, Home as HomeIcon, FileCheck, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Sidebar, 
  SidebarContent, 
  SidebarGroup, 
  SidebarGroupContent, 
  SidebarGroupLabel, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton, 
  SidebarProvider,
  SidebarInset,
  SidebarTrigger
} from "@/components/ui/sidebar";

interface NavigationItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  testId: string;
}

interface PortalLayoutProps {
  children: React.ReactNode;
  pageTitle?: string;
}

const navigationItems: NavigationItem[] = [
  {
    href: "/",
    icon: HomeIcon,
    label: "Home",
    testId: "nav-home"
  },
  {
    href: "/status-correction",
    icon: FileCheck,
    label: "Status Correction",
    testId: "nav-status-correction"
  },
  {
    href: "/ministry-legitimation",
    icon: Building,
    label: "Ministry Legitimation",
    testId: "nav-ministry-legitimation"
  }
];

export default function PortalLayout({ children, pageTitle }: PortalLayoutProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location] = useLocation();

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const getPageTitle = () => {
    if (pageTitle) return pageTitle;
    
    const currentNav = navigationItems.find(item => item.href === location);
    if (currentNav) return currentNav.label;
    
    return "Family Portal";
  };

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Family Portal</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navigationItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.href;
                  
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link href={item.href} data-testid={item.testId}>
                          <Icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      
      <SidebarInset>
        <div className="min-h-screen bg-background">
          {/* Header */}
          <header className="bg-card border-b border-border">
            <div className="flex justify-between items-center h-16 px-4">
              <div className="flex items-center">
                <SidebarTrigger />
                <div className="w-8 h-8 bg-primary rounded flex items-center justify-center mr-3">
                  <Shield className="text-primary-foreground" />
                </div>
                <h1 className="text-xl font-bold text-card-foreground" data-testid="text-page-title">
                  {user?.family?.name || "Family"} {getPageTitle()}
                </h1>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="flex items-center text-sm text-muted-foreground">
                  <Clock className="w-4 h-4 mr-2" />
                  <span data-testid="text-last-update">Last Updated: {new Date().toLocaleDateString()}</span>
                </div>
                <Link href="/notifications">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-primary"
                    data-testid="button-notifications"
                  >
                    <Bell className="w-4 h-4" />
                  </Button>
                </Link>
                <Button
                  onClick={handleLogout}
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-primary"
                  data-testid="button-logout"
                >
                  <i className="fas fa-sign-out-alt" />
                </Button>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}