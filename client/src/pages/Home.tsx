import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, UserPlus } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import PortalLayout from "@/components/PortalLayout";
import FamilyStats from "@/components/FamilyStats";
import DocumentCenter from "@/components/DocumentCenter";
import MessageCenter from "@/components/MessageCenter";
import OnboardingFlow from "@/components/OnboardingFlow";
import { useOnboarding } from "@/hooks/useOnboarding";
import type { FamilyStats as FamilyStatsType } from "@/lib/types";

export default function Home() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [showJoinFamily, setShowJoinFamily] = useState(false);
  const [familyCode, setFamilyCode] = useState("");
  const { showOnboarding, markOnboardingComplete } = useOnboarding();

  const { data: familyStats, isLoading: statsLoading } = useQuery<FamilyStatsType>({
    queryKey: [`/api/stats/family/${user?.familyId}`],
    enabled: !!user?.familyId,
    retry: false,
  });

  // Check for pending family code after auth
  useEffect(() => {
    const pendingCode = sessionStorage.getItem('pendingFamilyCode');
    if (pendingCode && user && !user.familyId) {
      setFamilyCode(pendingCode);
      setShowJoinFamily(true);
      sessionStorage.removeItem('pendingFamilyCode');
    }
  }, [user]);

  const joinFamilyMutation = useMutation({
    mutationFn: async (data: { familyCode: string }) => {
      const response = await apiRequest('POST', '/api/families/join', data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Successfully joined family portal!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setShowJoinFamily(false);
      window.location.reload(); // Refresh to update auth state
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to join family",
        variant: "destructive",
      });
    },
  });

  const handleJoinFamily = (e: React.FormEvent) => {
    e.preventDefault();
    if (!familyCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter a family code",
        variant: "destructive",
      });
      return;
    }
    joinFamilyMutation.mutate({ familyCode });
  };

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

  // Show family join screen if user doesn't have a family
  if (!user.familyId || showJoinFamily) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-card border-border">
          <CardHeader className="text-center">
            <UserPlus className="h-12 w-12 text-primary mx-auto mb-4" />
            <CardTitle className="text-2xl text-card-foreground">Join Your Family Portal</CardTitle>
            <CardDescription className="text-muted-foreground">
              Enter the family access code provided by your administrator
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoinFamily} className="space-y-4">
              <div>
                <label htmlFor="familyCode" className="block text-sm font-medium text-card-foreground mb-2">
                  Family Access Code
                </label>
                <Input
                  id="familyCode"
                  type="text"
                  value={familyCode}
                  onChange={(e) => setFamilyCode(e.target.value)}
                  placeholder="Enter family code"
                  data-testid="input-family-code"
                  className="bg-background border-border text-card-foreground placeholder-muted-foreground"
                  required
                />
              </div>
              <Button
                type="submit"
                data-testid="button-join-family"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={joinFamilyMutation.isPending}
              >
                {joinFamilyMutation.isPending ? "Joining..." : "Join Family"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <PortalLayout>
      {/* Progress Overview */}
      <FamilyStats familyId={user.familyId || undefined} stats={familyStats} isLoading={statsLoading} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Main Dashboard Content */}
        <div className="space-y-6">
          {/* Welcome Section */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Welcome to Your Family Portal
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Your central hub for managing family case progress and documents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="border border-border/50 bg-background/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                        <Shield className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-card-foreground">Status Correction</p>
                        <p className="text-sm text-muted-foreground">Complete your tasks</p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full mt-3"
                      onClick={() => window.location.href = '/status-correction'}
                      data-testid="button-go-to-status-correction"
                    >
                      View Tasks
                    </Button>
                  </CardContent>
                </Card>
                
                <Card className="border border-border/50 bg-background/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-secondary/20 rounded-lg flex items-center justify-center">
                        <Shield className="w-5 h-5 text-secondary-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-card-foreground">Ministry Legitimation</p>
                        <p className="text-sm text-muted-foreground">Process documents</p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full mt-3"
                      onClick={() => window.location.href = '/ministry-legitimation'}
                      data-testid="button-go-to-ministry-legitimation"
                    >
                      View Checklist
                    </Button>
                  </CardContent>
                </Card>
              </div>
              
              <div className="pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground mb-3">Quick Overview:</p>
                <div className="flex flex-wrap gap-2">
                  {familyStats && (
                    <>
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-3 h-3 bg-primary rounded-full"></div>
                        <span className="text-card-foreground">{familyStats.completed} tasks completed</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-3 h-3 bg-chart-3 rounded-full"></div>
                        <span className="text-card-foreground">{familyStats.pending} tasks pending</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-3 h-3 bg-secondary rounded-full"></div>
                        <span className="text-card-foreground">{Math.round(familyStats.progress)}% overall progress</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Document Center */}
          <DocumentCenter familyId={user.familyId || undefined} />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Messages from Admin */}
          <MessageCenter familyId={user.familyId || undefined} userRole={user.role} />
          
          {/* Quick Actions */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground">Quick Actions</CardTitle>
              <CardDescription className="text-muted-foreground">
                Common tasks and helpful links
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => window.location.href = '/status-correction'}
                data-testid="button-quick-status-correction"
              >
                <Shield className="w-4 h-4 mr-2" />
                Go to Status Correction
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => window.location.href = '/ministry-legitimation'}
                data-testid="button-quick-ministry-legitimation"
              >
                <Shield className="w-4 h-4 mr-2" />
                Ministry Legitimation Process
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => window.location.href = '/notifications'}
                data-testid="button-quick-notifications"
              >
                <Shield className="w-4 h-4 mr-2" />
                View Notifications
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Onboarding Flow */}
      {showOnboarding && (
        <OnboardingFlow
          onComplete={markOnboardingComplete}
          userRole="family"
        />
      )}
    </PortalLayout>
  );
}
