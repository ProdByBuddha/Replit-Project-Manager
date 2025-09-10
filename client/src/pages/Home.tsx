import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Clock } from "lucide-react";
import FamilyStats from "@/components/FamilyStats";
import TaskChecklist from "@/components/TaskChecklist";
import DocumentCenter from "@/components/DocumentCenter";
import MessageCenter from "@/components/MessageCenter";
import type { FamilyStats as FamilyStatsType } from "@/lib/types";

export default function Home() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const { data: familyStats, isLoading: statsLoading } = useQuery<FamilyStatsType>({
    queryKey: ["/api/stats/family", user?.familyId],
    enabled: !!user?.familyId,
    retry: false,
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <p className="text-muted-foreground">Loading your portal...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-primary rounded flex items-center justify-center mr-3">
                <Shield className="text-primary-foreground" />
              </div>
              <h1 className="text-xl font-bold text-card-foreground" data-testid="text-family-name">
                {user.family?.name || "Family"} Portal
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-sm text-muted-foreground">
                <Clock className="w-4 h-4 mr-2" />
                <span data-testid="text-last-update">Last Updated: {new Date().toLocaleDateString()}</span>
              </div>
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
        {/* Progress Overview */}
        <FamilyStats familyId={user.familyId || undefined} stats={familyStats} isLoading={statsLoading} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Task Checklist */}
          <div className="lg:col-span-2">
            <TaskChecklist familyId={user.familyId || undefined} />
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Document Center */}
            <DocumentCenter familyId={user.familyId || undefined} />
            
            {/* Messages from Admin */}
            <MessageCenter familyId={user.familyId || undefined} userRole={user.role} />
          </div>
        </div>
      </div>
    </div>
  );
}
