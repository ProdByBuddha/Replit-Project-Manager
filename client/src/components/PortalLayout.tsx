import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Link } from "wouter";
import { Shield, Clock, Bell, Home as HomeIcon, FileCheck, Building, Settings, Users, BarChart3 } from "lucide-react";
import { Permission } from "@shared/permissions";
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
import ChatWidget from "@/components/ChatWidget";

interface NavigationItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  testId: string;
  permission?: Permission;
  adminOnly?: boolean;
  roles?: string[];
}

interface PortalLayoutProps {
  children: React.ReactNode;
  pageTitle?: string;
}

const allNavigationItems: NavigationItem[] = [
  {
    href: "/",
    icon: HomeIcon,
    label: "Home",
    testId: "nav-home",
    permission: Permission.VIEW_FAMILY_TASKS
  },
  {
    href: "/status-correction",
    icon: FileCheck,
    label: "Status Correction",
    testId: "nav-status-correction",
    permission: Permission.VIEW_STATUS_CORRECTION
  },
  {
    href: "/ministry-legitimation",
    icon: Building,
    label: "Ministry Legitimation",
    testId: "nav-ministry-legitimation",
    permission: Permission.VIEW_MINISTRY_LEGITIMATION
  },
  {
    href: "/admin",
    icon: BarChart3,
    label: "Admin Dashboard",
    testId: "nav-admin",
    permission: Permission.VIEW_ADMIN_DASHBOARD,
    adminOnly: true
  },
  {
    href: "/admin/users",
    icon: Users,
    label: "User Management",
    testId: "nav-admin-users",
    permission: Permission.MANAGE_USERS,
    adminOnly: true
  },
  {
    href: "/admin/settings",
    icon: Settings,
    label: "System Settings",
    testId: "nav-admin-settings",
    permission: Permission.MANAGE_SYSTEM_SETTINGS,
    adminOnly: true
  }
];

export default function PortalLayout({ children, pageTitle }: PortalLayoutProps) {
  const { 
    user, 
    isLoading, 
    hasPermission, 
    canAccessAdmin, 
    isAdmin,
    userRole,
    roleDisplayName 
  } = useAuth();
  const { toast } = useToast();
  const [location] = useLocation();

  // Filter navigation items based on user permissions
  const visibleNavigationItems = allNavigationItems.filter(item => {
    // If no permission is specified, show the item
    if (!item.permission) return true;
    
    // If it's admin-only and user is not admin, hide it
    if (item.adminOnly && !isAdmin()) return false;
    
    // Check if user has the required permission
    return hasPermission(item.permission);
  });

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const getPageTitle = () => {
    if (pageTitle) return pageTitle;
    
    const currentNav = visibleNavigationItems.find(item => item.href === location);
    if (currentNav) return currentNav.label;
    
    return "Family Portal";
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-8 h-8 mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Family Portal</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleNavigationItems.map((item) => {
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
      
      {/* Chat Widget - Available on all portal pages */}
      <ChatWidget />
    </SidebarProvider>
  );
}