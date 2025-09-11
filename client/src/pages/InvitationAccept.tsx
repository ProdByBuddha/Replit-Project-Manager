import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { UserPlus, Users, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { formatDistance } from "date-fns";

interface InvitationDetails {
  id: string;
  familyId: string;
  inviterUserId: string;
  inviteeEmail: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  family: {
    id: string;
    name: string;
    familyCode: string;
  };
  inviter: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
  };
}

export default function InvitationAccept() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/invite/:code");
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [loadingInvitation, setLoadingInvitation] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const invitationCode = params?.code;

  // Fetch invitation details
  useEffect(() => {
    const fetchInvitation = async () => {
      if (!invitationCode) {
        setError("Invalid invitation link");
        setLoadingInvitation(false);
        return;
      }

      try {
        const response = await fetch(`/api/invitations/code/${invitationCode}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError("Invitation not found or expired");
          } else {
            throw new Error("Failed to fetch invitation details");
          }
        } else {
          const invitationData = await response.json();
          setInvitation(invitationData);
        }
      } catch (err) {
        console.error("Error fetching invitation:", err);
        setError("Failed to load invitation details");
      } finally {
        setLoadingInvitation(false);
      }
    };

    // Only fetch if we have an invitation code
    if (invitationCode && !authLoading) {
      fetchInvitation();
    } else if (!authLoading && !isAuthenticated && invitationCode) {
      // Store invitation code for after auth
      sessionStorage.setItem('pendingInvitationCode', invitationCode);
    }
  }, [invitationCode, authLoading]);

  // Check for pending invitation after auth
  useEffect(() => {
    const pendingCode = sessionStorage.getItem('pendingInvitationCode');
    if (pendingCode && isAuthenticated && user && !user.familyId) {
      // Clean up storage
      sessionStorage.removeItem('pendingInvitationCode');
      
      // Reload page with the invitation code
      if (pendingCode !== invitationCode) {
        setLocation(`/invite/${pendingCode}`);
      }
    }
  }, [isAuthenticated, user, invitationCode, setLocation]);

  const acceptInvitationMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest('PUT', `/api/invitations/${code}/accept`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Welcome to the family!",
        description: "You have successfully joined the family portal.",
      });
      
      // Redirect to family dashboard
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to accept invitation",
        variant: "destructive",
      });
    },
  });

  const handleLogin = () => {
    if (invitationCode) {
      sessionStorage.setItem('pendingInvitationCode', invitationCode);
    }
    window.location.href = "/api/login";
  };

  const handleAcceptInvitation = () => {
    if (invitationCode) {
      acceptInvitationMutation.mutate(invitationCode);
    }
  };

  const getDisplayName = (inviter: InvitationDetails['inviter']) => {
    if (inviter.firstName && inviter.lastName) {
      return `${inviter.firstName} ${inviter.lastName}`;
    }
    return inviter.email || 'Unknown';
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  // Loading state
  if (authLoading || loadingInvitation) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-card border-border">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserPlus className="w-8 h-8 text-primary animate-pulse" />
            </div>
            <p className="text-muted-foreground">Loading invitation details...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-card border-border">
          <CardHeader className="text-center">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <CardTitle className="text-card-foreground">Invalid Invitation</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">{error}</p>
            <Button 
              onClick={() => setLocation("/")}
              data-testid="button-go-home"
              className="w-full"
            >
              Go to Home Page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not authenticated - show login prompt
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-card border-border">
          <CardHeader className="text-center">
            <UserPlus className="w-12 h-12 text-primary mx-auto mb-4" />
            <CardTitle className="text-card-foreground">Family Invitation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">
                You've been invited to join a family portal. Please sign in to accept this invitation.
              </p>
              <Button 
                onClick={handleLogin}
                data-testid="button-sign-in"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Sign In to Accept Invitation
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already part of a family
  if (user?.familyId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-card border-border">
          <CardHeader className="text-center">
            <Users className="w-12 h-12 text-primary mx-auto mb-4" />
            <CardTitle className="text-card-foreground">Already a Family Member</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              You are already part of a family. You cannot accept invitations while being a member of another family.
            </p>
            <Button 
              onClick={() => setLocation("/")}
              data-testid="button-go-to-dashboard"
              className="w-full"
            >
              Go to Family Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invitation not found or couldn't load
  if (!invitation) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-card border-border">
          <CardHeader className="text-center">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <CardTitle className="text-card-foreground">Invitation Not Found</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              This invitation could not be found or is not addressed to your email ({user?.email}).
            </p>
            <Button 
              onClick={() => setLocation("/")}
              data-testid="button-go-home"
              className="w-full"
            >
              Go to Home Page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check invitation status
  const expired = isExpired(invitation.expiresAt);
  const canAccept = invitation.status === "pending" && !expired;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card border-border">
        <CardHeader className="text-center">
          <Users className="w-12 h-12 text-primary mx-auto mb-4" />
          <CardTitle className="text-card-foreground">Family Invitation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Invitation Details */}
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="font-semibold text-lg text-card-foreground">{invitation.family.name}</h3>
              <p className="text-muted-foreground">
                Invited by {getDisplayName(invitation.inviter)}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status:</span>
              <Badge 
                className={`${
                  invitation.status === "pending" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100" :
                  invitation.status === "accepted" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" :
                  "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                }`}
              >
                {invitation.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                {invitation.status === "accepted" && <CheckCircle className="h-3 w-3 mr-1" />}
                <span className="capitalize">{invitation.status}</span>
              </Badge>
            </div>

            <div className="text-sm text-muted-foreground text-center">
              <p>
                Sent {formatDistance(new Date(invitation.createdAt), new Date(), { addSuffix: true })}
              </p>
              {!expired ? (
                <p>
                  Expires {formatDistance(new Date(invitation.expiresAt), new Date(), { addSuffix: true })}
                </p>
              ) : (
                <p className="text-destructive">This invitation has expired</p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {canAccept ? (
              <Button
                onClick={handleAcceptInvitation}
                disabled={acceptInvitationMutation.isPending}
                data-testid="button-accept-invitation"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {acceptInvitationMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                    Accepting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Accept Invitation
                  </>
                )}
              </Button>
            ) : (
              <div className="text-center py-4">
                {expired ? (
                  <p className="text-destructive text-sm">
                    This invitation has expired and cannot be accepted.
                  </p>
                ) : invitation.status === "accepted" ? (
                  <p className="text-green-600 text-sm">
                    This invitation has already been accepted.
                  </p>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    This invitation is no longer available.
                  </p>
                )}
              </div>
            )}

            <Button 
              variant="outline"
              onClick={() => setLocation("/")}
              data-testid="button-go-back"
              className="w-full"
            >
              Go Back
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}