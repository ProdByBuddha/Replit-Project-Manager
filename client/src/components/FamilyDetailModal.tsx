import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Users, 
  CheckCircle, 
  Clock, 
  FileText, 
  TrendingUp,
  User,
  Mail,
  Calendar,
  Activity,
  Edit3,
  Save
} from "lucide-react";
import type { 
  FamilyWithMembers, 
  FamilyTaskWithTask, 
  DocumentWithUploader,
  MessageWithUser,
  FamilyStats as FamilyStatsType
} from "@/lib/types";

interface FamilyDetailModalProps {
  familyId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function FamilyDetailModal({ familyId, isOpen, onClose }: FamilyDetailModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === 'admin';
  const { data: family, isLoading: familyLoading } = useQuery<FamilyWithMembers>({
    queryKey: [`/api/families/${familyId}`],
    enabled: !!familyId && isOpen,
    retry: false,
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<FamilyTaskWithTask[]>({
    queryKey: ["/api/tasks", familyId],
    enabled: !!familyId && isOpen,
    retry: false,
  });

  const { data: documents = [], isLoading: documentsLoading } = useQuery<DocumentWithUploader[]>({
    queryKey: ["/api/documents", familyId],
    enabled: !!familyId && isOpen,
    retry: false,
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery<MessageWithUser[]>({
    queryKey: ["/api/messages", familyId],
    enabled: !!familyId && isOpen,
    retry: false,
  });

  const { data: familyStats, isLoading: statsLoading } = useQuery<FamilyStatsType>({
    queryKey: [`/api/stats/family/${familyId}`],
    enabled: !!familyId && isOpen,
    retry: false,
  });

  // Admin task status update mutation
  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      const response = await apiRequest('PUT', `/api/tasks/${taskId}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Task status updated successfully!",
      });
      
      // Invalidate relevant caches
      queryClient.invalidateQueries({
        queryKey: ["/api/tasks", familyId]
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/stats/family/${familyId}`]
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update task status",
        variant: "destructive",
      });
    },
  });

  const isLoading = familyLoading || tasksLoading || documentsLoading || messagesLoading || statsLoading;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-chart-2/20 text-chart-2 border-chart-2/20";
      case "in_progress": return "bg-chart-3/20 text-chart-3 border-chart-3/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed": return "Completed";
      case "in_progress": return "In Progress";
      case "not_started": return "Not Started";
      default: return status;
    }
  };

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return 'Unknown';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!familyId || !isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3" data-testid="family-detail-title">
            <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            {family ? (
              <div>
                <h2 className="text-xl font-bold">{family.name}</h2>
                <p className="text-sm text-muted-foreground font-normal">
                  Family Code: {family.familyCode}
                </p>
              </div>
            ) : (
              <div className="animate-pulse">
                <div className="h-6 bg-muted rounded w-48 mb-1" />
                <div className="h-4 bg-muted rounded w-32" />
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-6">
            {/* Loading skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-muted rounded-lg mr-4" />
                      <div>
                        <div className="h-6 bg-muted rounded w-16 mb-2" />
                        <div className="h-4 bg-muted rounded w-20" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Family Stats */}
            {familyStats && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6" data-testid="family-detail-stats">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-chart-2/20 rounded-lg flex items-center justify-center mr-3">
                        <CheckCircle className="w-5 h-5 text-chart-2" />
                      </div>
                      <div>
                        <div className="text-lg font-bold" data-testid="family-completed-tasks">
                          {familyStats.completed}
                        </div>
                        <div className="text-xs text-muted-foreground">Completed</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-chart-3/20 rounded-lg flex items-center justify-center mr-3">
                        <Clock className="w-5 h-5 text-chart-3" />
                      </div>
                      <div>
                        <div className="text-lg font-bold" data-testid="family-pending-tasks">
                          {familyStats.pending}
                        </div>
                        <div className="text-xs text-muted-foreground">Pending</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-chart-1/20 rounded-lg flex items-center justify-center mr-3">
                        <FileText className="w-5 h-5 text-chart-1" />
                      </div>
                      <div>
                        <div className="text-lg font-bold" data-testid="family-documents-count">
                          {familyStats.documents}
                        </div>
                        <div className="text-xs text-muted-foreground">Documents</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center mr-3">
                        <TrendingUp className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="text-lg font-bold" data-testid="family-progress-percent">
                          {familyStats.progress}%
                        </div>
                        <div className="text-xs text-muted-foreground">Progress</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Progress Bar */}
            {familyStats && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium">Overall Progress</h3>
                  <span className="text-sm text-muted-foreground">
                    {familyStats.completed} of {familyStats.completed + familyStats.pending} tasks completed
                  </span>
                </div>
                <Progress value={familyStats.progress} className="h-3" data-testid="family-overall-progress" />
              </div>
            )}

            <Tabs defaultValue="members" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="members" data-testid="tab-members">Members</TabsTrigger>
                <TabsTrigger value="tasks" data-testid="tab-tasks">Tasks</TabsTrigger>
                <TabsTrigger value="documents" data-testid="tab-documents">Documents</TabsTrigger>
                <TabsTrigger value="messages" data-testid="tab-messages">Messages</TabsTrigger>
              </TabsList>

              <TabsContent value="members" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5" />
                      Family Members ({family?.members?.length || 0})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {family?.members && family.members.length > 0 ? (
                      <div className="space-y-4" data-testid="family-members-list">
                        {family.members.map((member) => (
                          <div key={member.id} className="flex items-center space-x-4 p-4 border rounded-lg" data-testid={`member-${member.id}`}>
                            <Avatar>
                              <AvatarImage src={member.profileImageUrl || undefined} />
                              <AvatarFallback>
                                {(member.firstName?.[0] || member.email?.[0] || 'U').toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium" data-testid={`member-name-${member.id}`}>
                                  {member.firstName && member.lastName 
                                    ? `${member.firstName} ${member.lastName}`
                                    : member.email
                                  }
                                </h4>
                                <Badge variant="secondary" className={member.role === 'admin' ? 'bg-primary/20 text-primary' : ''}>
                                  {member.role}
                                </Badge>
                              </div>
                              <div className="flex items-center text-sm text-muted-foreground mt-1">
                                <Mail className="w-4 h-4 mr-1" />
                                <span data-testid={`member-email-${member.id}`}>{member.email}</span>
                              </div>
                              <div className="flex items-center text-sm text-muted-foreground mt-1">
                                <Calendar className="w-4 h-4 mr-1" />
                                <span>Joined {formatDate(member.createdAt || '')}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No family members found</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="tasks" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="w-5 h-5" />
                      Tasks Progress ({tasks.length} total)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {tasks.length > 0 ? (
                      <div className="space-y-4" data-testid="family-tasks-list">
                        {tasks.map((familyTask) => (
                          <div key={familyTask.id} className="p-4 border rounded-lg" data-testid={`task-${familyTask.id}`}>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="font-medium mb-1" data-testid={`task-title-${familyTask.id}`}>
                                  {familyTask.task.title}
                                </h4>
                                <p className="text-sm text-muted-foreground mb-2" data-testid={`task-description-${familyTask.id}`}>
                                  {familyTask.task.description}
                                </p>
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge className={getStatusColor(familyTask.status)} data-testid={`task-status-${familyTask.id}`}>
                                    {getStatusText(familyTask.status)}
                                  </Badge>
                                  <Badge variant="outline" data-testid={`task-category-${familyTask.id}`}>
                                    {familyTask.task.category}
                                  </Badge>
                                </div>
                                
                                {/* Admin Task Status Controls */}
                                {isAdmin && (
                                  <div className="flex items-center gap-2 mt-3 p-3 bg-muted/30 rounded-lg">
                                    <Edit3 className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-sm font-medium text-muted-foreground">Admin Controls:</span>
                                    <Select
                                      value={familyTask.status}
                                      onValueChange={(status) => {
                                        updateTaskStatusMutation.mutate({
                                          taskId: familyTask.id,
                                          status
                                        });
                                      }}
                                      disabled={updateTaskStatusMutation.isPending}
                                      data-testid={`select-task-status-${familyTask.id}`}
                                    >
                                      <SelectTrigger className="w-40">
                                        <SelectValue>
                                          <span className="capitalize">{getStatusText(familyTask.status)}</span>
                                        </SelectValue>
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="not_started" data-testid={`status-not-started-${familyTask.id}`}>
                                          <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                                            Not Started
                                          </div>
                                        </SelectItem>
                                        <SelectItem value="in_progress" data-testid={`status-in-progress-${familyTask.id}`}>
                                          <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-chart-3" />
                                            In Progress
                                          </div>
                                        </SelectItem>
                                        <SelectItem value="completed" data-testid={`status-completed-${familyTask.id}`}>
                                          <div className="flex items-center gap-2">
                                            <CheckCircle className="w-4 h-4 text-chart-2" />
                                            Completed
                                          </div>
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                    {updateTaskStatusMutation.isPending && (
                                      <div className="w-4 h-4 border-2 border-t-transparent border-current rounded-full animate-spin" />
                                    )}
                                  </div>
                                )}
                                
                                {familyTask.notes && (
                                  <p className="text-sm text-muted-foreground mt-2" data-testid={`task-notes-${familyTask.id}`}>
                                    <strong>Notes:</strong> {familyTask.notes}
                                  </p>
                                )}
                              </div>
                              <div className="text-right text-sm text-muted-foreground ml-4">
                                {familyTask.completedAt && (
                                  <p>Completed: {formatDate(familyTask.completedAt)}</p>
                                )}
                                <p>Updated: {formatDate(familyTask.updatedAt || familyTask.createdAt || '')}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No tasks assigned to this family</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="documents" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Documents ({documents.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {documents.length > 0 ? (
                      <div className="space-y-4" data-testid="family-documents-list">
                        {documents.map((doc) => (
                          <div key={doc.id} className="p-4 border rounded-lg" data-testid={`document-${doc.id}`}>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="font-medium mb-1" data-testid={`document-name-${doc.id}`}>
                                  {doc.originalFileName}
                                </h4>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  <span>
                                    Size: {(doc.fileSize / 1024).toFixed(1)} KB
                                  </span>
                                  <span>
                                    Type: {doc.mimeType}
                                  </span>
                                  <span>
                                    Uploaded by: {doc.uploader.firstName || doc.uploader.email}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right text-sm text-muted-foreground">
                                <p>{formatDate(doc.createdAt || '')}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No documents uploaded yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="messages" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="w-5 h-5" />
                      Messages ({messages.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {messages.length > 0 ? (
                      <div className="space-y-4" data-testid="family-messages-list">
                        {messages.map((message) => (
                          <div key={message.id} className="p-4 border rounded-lg" data-testid={`message-${message.id}`}>
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium" data-testid={`message-subject-${message.id}`}>
                                  {message.subject}
                                </h4>
                                {!message.isRead && (
                                  <Badge variant="secondary">New</Badge>
                                )}
                              </div>
                              <div className="text-right text-sm text-muted-foreground">
                                <p>From: {message.fromUser.role === 'admin' ? 'Admin' : message.fromUser.email}</p>
                                <p>{formatDate(message.createdAt || '')}</p>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground" data-testid={`message-content-${message.id}`}>
                              {message.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No messages yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}