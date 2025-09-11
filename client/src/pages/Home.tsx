import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Clock, UserPlus, Bell } from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import FamilyStats from "@/components/FamilyStats";
import TaskChecklist from "@/components/TaskChecklist";
import DocumentCenter from "@/components/DocumentCenter";
import MessageCenter from "@/components/MessageCenter";
import InvitationForm from "@/components/InvitationForm";
import InvitationManager from "@/components/InvitationManager";
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

      {/* Onboarding Flow */}
      {showOnboarding && (
        <OnboardingFlow
          onComplete={markOnboardingComplete}
          userRole="family"
        />
      )}
    </div>
  );
}
