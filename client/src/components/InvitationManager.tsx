import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Mail, Clock, CheckCircle, XCircle, X, Users, ArrowRight } from "lucide-react";
import { formatDistance } from "date-fns";
import type { Invitation } from "@shared/schema";

interface InvitationWithInviter extends Invitation {
  inviter: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
  };
}

interface InvitationWithFamily extends Invitation {
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

interface InvitationManagerProps {
  className?: string;
}

export default function InvitationManager({ className }: InvitationManagerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [invitationToCancel, setInvitationToCancel] = useState<string | null>(null);

  // Query for sent invitations (family invitations)
  const { data: sentInvitations = [], isLoading: isLoadingSent } = useQuery<InvitationWithInviter[]>({
    queryKey: ["/api/invitations"],
    enabled: !!user?.familyId,
    retry: false,
  });

  // Query for received invitations (by email)
  const { data: receivedInvitations = [], isLoading: isLoadingReceived } = useQuery<InvitationWithFamily[]>({
    queryKey: [`/api/invitations/received/${user?.email}`],
    enabled: !!user?.email && !user?.familyId,
    retry: false,
  });

  const cancelInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const response = await apiRequest('DELETE', `/api/invitations/${invitationId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Invitation cancelled successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel invitation",
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100";
      case "accepted":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100";
      case "declined":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100";
      case "expired":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-3 w-3" />;
      case "accepted":
        return <CheckCircle className="h-3 w-3" />;
      case "declined":
      case "expired":
        return <XCircle className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getDisplayName = (inviter: InvitationWithInviter['inviter'] | InvitationWithFamily['inviter']) => {
    if (inviter.firstName && inviter.lastName) {
      return `${inviter.firstName} ${inviter.lastName}`;
    }
    return inviter.email || 'Unknown';
  };

  const handleCancelInvitation = () => {
    if (invitationToCancel) {
      cancelInvitationMutation.mutate(invitationToCancel);
      setInvitationToCancel(null);
    }
  };

  if (!user?.familyId && (!user?.email || receivedInvitations.length === 0)) {
    return null;
  }

  return (
    <Card className={`bg-card border-border ${className}`}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-card-foreground">
          <Mail className="h-5 w-5 text-primary" />
          Invitation Management
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={user?.familyId ? "sent" : "received"} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger 
              value="sent" 
              data-testid="tab-sent-invitations"
              disabled={!user?.familyId}
            >
              <Users className="h-4 w-4 mr-2" />
              Sent ({sentInvitations.length})
            </TabsTrigger>
            <TabsTrigger 
              value="received"
              data-testid="tab-received-invitations"
            >
              <ArrowRight className="h-4 w-4 mr-2" />
              Received ({receivedInvitations.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sent" className="mt-4">
            {isLoadingSent ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="bg-muted rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2 flex-1">
                          <div className="h-4 bg-muted-foreground/20 rounded w-1/3" />
                          <div className="h-3 bg-muted-foreground/20 rounded w-1/4" />
                        </div>
                        <div className="h-6 w-16 bg-muted-foreground/20 rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : sentInvitations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No invitations sent yet</p>
                <p className="text-sm">Use the invitation form above to invite family members</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sentInvitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    data-testid={`invitation-sent-${invitation.id}`}
                    className="bg-background border border-border rounded-lg p-4"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-foreground">{invitation.inviteeEmail}</h4>
                          <Badge 
                            className={`${getStatusColor(invitation.status)} text-xs`}
                          >
                            {getStatusIcon(invitation.status)}
                            <span className="ml-1 capitalize">{invitation.status}</span>
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>
                            Invited by {getDisplayName(invitation.inviter)} • {' '}
                            {formatDistance(new Date(invitation.createdAt), new Date(), { addSuffix: true })}
                          </p>
                          {invitation.status === "pending" && (
                            <p>
                              Expires {formatDistance(new Date(invitation.expiresAt), new Date(), { addSuffix: true })}
                            </p>
                          )}
                        </div>
                      </div>
                      {invitation.status === "pending" && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              data-testid={`button-cancel-invitation-${invitation.id}`}
                              onClick={() => setInvitationToCancel(invitation.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancel Invitation</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to cancel the invitation to {invitation.inviteeEmail}? 
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep Invitation</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={handleCancelInvitation}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Cancel Invitation
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="received" className="mt-4">
            {isLoadingReceived ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="bg-muted rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2 flex-1">
                          <div className="h-4 bg-muted-foreground/20 rounded w-1/2" />
                          <div className="h-3 bg-muted-foreground/20 rounded w-1/3" />
                        </div>
                        <div className="h-8 w-20 bg-muted-foreground/20 rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : receivedInvitations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ArrowRight className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No invitations received</p>
                <p className="text-sm">Family invitations will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {receivedInvitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    data-testid={`invitation-received-${invitation.id}`}
                    className="bg-background border border-border rounded-lg p-4"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-foreground">{invitation.family.name}</h4>
                          <Badge 
                            className={`${getStatusColor(invitation.status)} text-xs`}
                          >
                            {getStatusIcon(invitation.status)}
                            <span className="ml-1 capitalize">{invitation.status}</span>
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>
                            Invited by {getDisplayName(invitation.inviter)} • {' '}
                            {formatDistance(new Date(invitation.createdAt), new Date(), { addSuffix: true })}
                          </p>
                          {invitation.status === "pending" && (
                            <p>
                              Expires {formatDistance(new Date(invitation.expiresAt), new Date(), { addSuffix: true })}
                            </p>
                          )}
                        </div>
                      </div>
                      {invitation.status === "pending" && (
                        <Button
                          data-testid={`button-view-invitation-${invitation.id}`}
                          size="sm"
                          onClick={() => {
                            // This will be implemented in the next task (invitation acceptance flow)
                            toast({
                              title: "Coming Soon",
                              description: "Invitation acceptance feature will be available shortly",
                            });
                          }}
                        >
                          View
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}