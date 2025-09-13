import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";
import PortalLayout from "@/components/PortalLayout";
import TaskChecklist from "@/components/TaskChecklist";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileCheck, Clock, CheckCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { FamilyStats as FamilyStatsType } from "@/lib/types";

export default function StatusCorrection() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const { data: familyStats, isLoading: statsLoading } = useQuery<FamilyStatsType>({
    queryKey: [`/api/stats/family/${user?.familyId}`],
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileCheck className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <p className="text-muted-foreground">Loading Status Correction...</p>
        </div>
      </div>
    );
  }

  if (!user || !user.familyId) {
    return null;
  }

  return (
    <PortalLayout pageTitle="Status Correction">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center mb-4">
          <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center mr-4">
            <FileCheck className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-card-foreground" data-testid="text-status-correction-title">
              Status Correction Process
            </h1>
            <p className="text-muted-foreground mt-1">
              Complete all required tasks to finalize your status correction
            </p>
          </div>
        </div>

        {/* Progress Overview */}
        {!statsLoading && familyStats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Completed Tasks</p>
                    <p className="text-2xl font-bold text-primary" data-testid="text-completed-count">
                      {familyStats.completed}
                    </p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pending Tasks</p>
                    <p className="text-2xl font-bold text-chart-3" data-testid="text-pending-count">
                      {familyStats.pending}
                    </p>
                  </div>
                  <Clock className="w-8 h-8 text-chart-3" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Overall Progress</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-2xl font-bold text-card-foreground" data-testid="text-progress-percentage">
                        {Math.round(familyStats.progress)}%
                      </p>
                      <Badge 
                        variant={familyStats.progress === 100 ? "default" : "secondary"}
                        className={familyStats.progress === 100 ? "bg-primary text-primary-foreground" : ""}
                        data-testid="badge-progress-status"
                      >
                        {familyStats.progress === 100 ? "Complete" : "In Progress"}
                      </Badge>
                    </div>
                  </div>
                  <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">
                      {Math.round(familyStats.progress)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Main Task Checklist */}
      <TaskChecklist familyId={user.familyId} />

      {/* Additional Information */}
      <div className="mt-8">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground">Important Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p data-testid="text-info-completion">
                • Complete all tasks in the order they appear to ensure proper status correction processing
              </p>
              <p data-testid="text-info-documents">
                • Upload all required documents when prompted during task completion
              </p>
              <p data-testid="text-info-dependencies">
                • Some tasks may require completion of prerequisite tasks before they can be started
              </p>
              <p data-testid="text-info-support">
                • Contact your administrator if you have questions about specific requirements
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}