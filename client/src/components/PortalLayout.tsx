import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Link } from "wouter";
import { 
  Shield, 
  Clock, 
  Bell, 
  Home as HomeIcon, 
  FileCheck, 
  Building, 
  Settings, 
  Users, 
  BarChart3,
  User,
  LogOut,
  ChevronDown,
  CreditCard,
  UserCircle,
  HelpCircle
} from "lucide-react";
import { Permission } from "@shared/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
          <header className="bg-card border-b border-border sticky top-0 z-50">
            <div className="flex justify-between items-center h-16 px-2 sm:px-4 lg:px-6">
              {/* Left side */}
              <div className="flex items-center min-w-0 flex-1">
                <SidebarTrigger className="mr-2 lg:mr-3" />
                <div className="w-8 h-8 bg-primary rounded flex items-center justify-center mr-2 lg:mr-3 flex-shrink-0">
                  <Shield className="w-4 h-4 text-primary-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg sm:text-xl font-bold text-card-foreground truncate" data-testid="text-page-title">
                    <span className="hidden sm:inline">{user?.family?.name || "Family"} </span>
                    <span className="sm:hidden">{getPageTitle()}</span>
                    <span className="hidden sm:inline">{getPageTitle()}</span>
                  </h1>
                </div>
              </div>
              
              {/* Right side */}
              <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-4">
                {/* Last updated - hidden on mobile */}
                <div className="hidden lg:flex items-center text-sm text-muted-foreground">
                  <Clock className="w-4 h-4 mr-2" />
                  <span data-testid="text-last-update">
                    Last Updated: {new Date().toLocaleDateString()}
                  </span>
                </div>
                
                {/* Notifications */}
                <Link href="/notifications">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-primary"
                    data-testid="button-notifications"
                  >
                    <Bell className="w-4 h-4" />
                    <span className="sr-only">Notifications</span>
                  </Button>
                </Link>

                {/* User Profile Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className="flex items-center space-x-2 hover:bg-accent/50 px-2 sm:px-3"
                      data-testid="button-user-profile"
                    >
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.firstName || undefined} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                          {user?.firstName?.[0]}{user?.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="hidden sm:flex flex-col items-start text-left">
                        <span className="text-sm font-medium text-card-foreground">
                          {user?.firstName} {user?.lastName}
                        </span>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs px-1 py-0">
                            {roleDisplayName}
                          </Badge>
                        </div>
                      </div>
                      <ChevronDown className="w-4 h-4 text-muted-foreground hidden sm:block" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium text-card-foreground">
                          {user?.firstName} {user?.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {user?.email}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {roleDisplayName}
                          </Badge>
                          {user?.family?.name && (
                            <Badge variant="secondary" className="text-xs">
                              {user.family.name}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link href="/profile" data-testid="menu-profile">
                        <UserCircle className="w-4 h-4 mr-2" />
                        <span>Profile Settings</span>
                      </Link>
                    </DropdownMenuItem>
                    
                    {isAdmin() && (
                      <>
                        <DropdownMenuItem asChild className="cursor-pointer">
                          <Link href="/admin" data-testid="menu-admin-dashboard">
                            <BarChart3 className="w-4 h-4 mr-2" />
                            <span>Admin Dashboard</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild className="cursor-pointer">
                          <Link href="/admin/users" data-testid="menu-user-management">
                            <Users className="w-4 h-4 mr-2" />
                            <span>User Management</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild className="cursor-pointer">
                          <Link href="/admin/settings" data-testid="menu-system-settings">
                            <Settings className="w-4 h-4 mr-2" />
                            <span>System Settings</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    
                    <DropdownMenuItem className="cursor-pointer" data-testid="menu-help">
                      <HelpCircle className="w-4 h-4 mr-2" />
                      <span>Help & Support</span>
                    </DropdownMenuItem>
                    
                    <DropdownMenuSeparator />
                    
                    <DropdownMenuItem 
                      onClick={handleLogout}
                      className="cursor-pointer text-red-600 dark:text-red-400"
                      data-testid="menu-logout"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      <span>Sign Out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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