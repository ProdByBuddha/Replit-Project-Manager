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
import TaskChecklist from "@/components/TaskChecklist";
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
