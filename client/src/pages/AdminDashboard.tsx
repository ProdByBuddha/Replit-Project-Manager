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
import OnboardingFlow from "@/components/OnboardingFlow";
import PortalLayout from "@/components/PortalLayout";
import { useOnboarding } from "@/hooks/useOnboarding";

export default function AdminDashboard() {
  const { user, isLoading, isAuthenticated, isAdmin } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const { showOnboarding, markOnboardingComplete } = useOnboarding();

  // Redirect to login if not authenticated or not admin
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !isAdmin())) {
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
  }, [isAuthenticated, isLoading, isAdmin, toast]);

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

  if (!user || !isAdmin()) {
    return null;
  }

  return (
    <PortalLayout pageTitle="Administrator Dashboard">
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

        {/* Onboarding Flow */}
        {showOnboarding && (
          <OnboardingFlow
            onComplete={markOnboardingComplete}
            userRole="admin"
          />
        )}
    </PortalLayout>
  );
}
