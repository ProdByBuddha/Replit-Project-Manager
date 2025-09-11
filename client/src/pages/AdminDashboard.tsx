import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Bell, Users, Network, Zap, BarChart3 } from "lucide-react";
import { Link } from "wouter";
import AdminStats from "@/components/AdminStats";
import FamilyManagement from "@/components/FamilyManagement";
import DependencyManagement from "@/components/DependencyManagement";
import WorkflowRulesManagement from "@/components/WorkflowRulesManagement";

export default function AdminDashboard() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  // Redirect to login if not authenticated or not admin
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || user?.role !== 'admin')) {
      toast({
        title: "Unauthorized",
        description: "Admin access required. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, user?.role, toast]);

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Settings className="w-8 h-8 text-accent animate-pulse" />
          </div>
          <p className="text-muted-foreground">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-accent rounded flex items-center justify-center mr-3">
                <Settings className="text-accent-foreground" />
              </div>
              <h1 className="text-xl font-bold text-card-foreground" data-testid="text-admin-title">
                Administrator Dashboard
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button
                className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90"
                data-testid="button-add-family"
              >
                <i className="fas fa-plus mr-2" />
                Add Family
              </Button>
              <Link href="/notifications">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-primary"
                  data-testid="button-admin-notifications"
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
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3" data-testid="tabs-admin-navigation">
            <TabsTrigger value="overview" className="flex items-center space-x-2" data-testid="tab-overview">
              <BarChart3 className="w-4 h-4" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="dependencies" className="flex items-center space-x-2" data-testid="tab-dependencies">
              <Network className="w-4 h-4" />
              <span>Dependencies</span>
            </TabsTrigger>
            <TabsTrigger value="workflow-rules" className="flex items-center space-x-2" data-testid="tab-workflow-rules">
              <Zap className="w-4 h-4" />
              <span>Workflow Rules</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8">
            {/* Admin Stats */}
            <AdminStats />
            
            {/* Family Management Table */}
            <FamilyManagement />
          </TabsContent>

          <TabsContent value="dependencies" className="space-y-6" data-testid="content-dependencies">
            <DependencyManagement />
          </TabsContent>

          <TabsContent value="workflow-rules" className="space-y-6" data-testid="content-workflow-rules">
            <WorkflowRulesManagement />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
