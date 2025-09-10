import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserCheck, AlertTriangle, Info, CheckCircle } from "lucide-react";
import type { MessageWithUser } from "@/lib/types";

interface MessageCenterProps {
  familyId?: string;
  userRole: string;
}

export default function MessageCenter({ familyId, userRole }: MessageCenterProps) {
  const { data: messages = [], isLoading } = useQuery<MessageWithUser[]>({
    queryKey: ["/api/messages"],
    enabled: !!familyId,
    retry: false,
  });

  const getMessageIcon = (messageType: string) => {
    switch (messageType) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-chart-2" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-chart-3" />;
      case "error":
        return <AlertTriangle className="w-4 h-4 text-destructive" />;
      default:
        return <Info className="w-4 h-4 text-primary" />;
    }
  };

  const getMessageBorderColor = (messageType: string) => {
    switch (messageType) {
      case "success":
        return "border-chart-2/20 bg-chart-2/10";
      case "warning":
        return "border-chart-3/20 bg-chart-3/10";
      case "error":
        return "border-destructive/20 bg-destructive/10";
      default:
        return "border-primary/20 bg-primary/10";
    }
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const messageDate = new Date(date);
    const diffMs = now.getTime() - messageDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) {
      return "Less than an hour ago";
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffDays === 1) {
      return "Yesterday";
    } else {
      return `${diffDays} days ago`;
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-card-foreground">Messages</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-start">
                    <div className="w-8 h-8 bg-muted rounded-full mr-3" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-1/3" />
                      <div className="h-3 bg-muted rounded w-full" />
                      <div className="h-3 bg-muted rounded w-1/4" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="border-b border-border">
        <CardTitle className="text-card-foreground" data-testid="text-messages-title">
          {userRole === 'admin' ? 'Family Messages' : 'Admin Messages'}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-6">
        {messages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground" data-testid="text-no-messages">
            <Info className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No messages yet</p>
            <p className="text-sm">New messages will appear here</p>
          </div>
        ) : (
          <div className="space-y-4" data-testid="container-messages-list">
            {messages.slice(0, 3).map((message: any) => (
              <div
                key={message.id}
                className={`p-4 border rounded-lg ${getMessageBorderColor(message.messageType)}`}
                data-testid={`message-item-${message.id}`}
              >
                <div className="flex items-start">
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center mr-3 mt-1">
                    {message.fromUser?.role === 'admin' ? (
                      <UserCheck className="text-primary-foreground text-xs" />
                    ) : (
                      getMessageIcon(message.messageType)
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-card-foreground" data-testid={`message-subject-${message.id}`}>
                        {message.subject}
                      </p>
                      {!message.isRead && (
                        <Badge variant="secondary" className="ml-2">New</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2" data-testid={`message-content-${message.id}`}>
                      {message.content}
                    </p>
                    <p className="text-xs text-muted-foreground" data-testid={`message-time-${message.id}`}>
                      {formatTimeAgo(message.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            
            {messages.length > 3 && (
              <div className="text-center pt-4" data-testid="text-more-messages">
                <p className="text-sm text-muted-foreground">
                  +{messages.length - 3} more messages
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
