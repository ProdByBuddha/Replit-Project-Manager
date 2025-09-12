import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Check, Clock, Upload, Lock, X, AlertCircle } from "lucide-react";
import { ObjectUploader } from "@/components/ObjectUploader";
import type { FamilyTaskWithTaskAndDependencies, TaskDependencyStatus } from "@/lib/types";
import type { UploadResult } from "@uppy/core";

interface TaskChecklistProps {
  familyId?: string;
}

export default function TaskChecklist({ familyId }: TaskChecklistProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery<FamilyTaskWithTaskAndDependencies[]>({
    queryKey: ["/api/tasks"],
    enabled: !!familyId,
    retry: false,
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, status, notes }: { taskId: string; status: string; notes?: string }) => {
      await apiRequest("PUT", `/api/tasks/${taskId}/status`, { status, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: [`/api/stats/family/${familyId}`] });
      toast({
        title: "Success",
        description: "Task status updated successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: "Failed to update task status",
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (taskId: string, newStatus: string) => {
    updateTaskMutation.mutate({ taskId, status: newStatus });
  };

  const handleGetUploadParameters = async () => {
    try {
      const response = await fetch("/api/objects/upload", {
        method: "POST",
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to get upload URL");
      }
      
      const data = await response.json();
      return {
        method: "PUT" as const,
        url: data.uploadURL,
      };
    } catch (error) {
      console.error("Error getting upload parameters:", error);
      toast({
        title: "Error",
        description: "Failed to prepare file upload",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleUploadComplete = async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    try {
      if (result.successful && result.successful.length > 0) {
        const file = result.successful[0];
        
        // Create document record
        const response = await fetch("/api/documents", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            fileName: file.name,
            originalFileName: file.name,
            fileSize: file.size,
            mimeType: file.type || "application/octet-stream",
            uploadURL: file.uploadURL,
            familyId,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to save document record");
        }

        toast({
          title: "Success",
          description: "Document uploaded successfully",
        });
        
        // Refresh document list
        queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      }
    } catch (error) {
      console.error("Error completing upload:", error);
      toast({
        title: "Error",
        description: "Failed to complete document upload",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <Check className="w-4 h-4 text-primary" />;
      case "in_progress":
        return <Clock className="w-4 h-4 text-chart-3" />;
      default:
        return <div className="w-4 h-4 border-2 border-muted-foreground rounded-full" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-primary/20 text-primary">Completed</Badge>;
      case "in_progress":
        return <Badge className="bg-chart-3/20 text-chart-3">In Progress</Badge>;
      default:
        return <Badge variant="secondary">Not Started</Badge>;
    }
  };

  const getDependencyStatusIndicator = (task: FamilyTaskWithTaskAndDependencies) => {
    if (!task.dependencyStatus) return null;
    
    const { canStart, blockedBy, dependsOn } = task.dependencyStatus;
    
    if (task.status === "completed") {
      return null; // Don't show dependency status for completed tasks
    }
    
    if (!canStart && blockedBy.length > 0) {
      return (
        <Badge variant="destructive" className="mb-2 text-xs">
          <Lock className="w-3 h-3 mr-1" />
          Blocked by {blockedBy.length} task{blockedBy.length !== 1 ? 's' : ''}
        </Badge>
      );
    }
    
    if (dependsOn.length > 0) {
      return (
        <Badge variant="outline" className="mb-2 text-xs">
          <AlertCircle className="w-3 h-3 mr-1" />
          {dependsOn.length} prerequisite{dependsOn.length !== 1 ? 's' : ''}
        </Badge>
      );
    }
    
    return null;
  };

  const getDependencyPanel = (task: FamilyTaskWithTaskAndDependencies) => {
    if (!task.dependencyStatus || task.dependencyStatus.dependsOn.length === 0) {
      return null;
    }
    
    const { dependsOn, blockedBy } = task.dependencyStatus;
    
    return (
      <div className="mt-3 p-3 bg-muted/20 rounded-lg border border-muted">
        <div className="text-xs font-medium text-muted-foreground mb-2">
          Prerequisites ({dependsOn.length}):
        </div>
        <div className="space-y-1">
          {dependsOn.map((depName, index) => {
            const isBlocking = blockedBy.includes(depName);
            return (
              <div key={index} className="flex items-center gap-2 text-sm">
                {!isBlocking ? (
                  <Check className="w-3 h-3 text-green-500" />
                ) : (
                  <X className="w-3 h-3 text-red-500" />
                )}
                <span className={!isBlocking ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}>
                  {depName}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const getBlockedTooltipContent = (blockedBy: string[]) => {
    if (blockedBy.length === 0) return null;
    
    return (
      <div className="max-w-xs">
        <p className="font-medium mb-2">Complete these tasks first:</p>
        <ul className="space-y-1">
          {blockedBy.map((taskName, index) => (
            <li key={index} className="text-sm">• {taskName}</li>
          ))}
        </ul>
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-card-foreground">Status Correction Checklist</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-start space-x-4 p-4 bg-muted/30 rounded-lg">
                  <div className="w-6 h-6 bg-muted rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
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
        <CardTitle className="text-card-foreground" data-testid="text-checklist-title">
          Status Correction Checklist
        </CardTitle>
        <p className="text-muted-foreground mt-1">Complete all items to finalize your status correction</p>
      </CardHeader>
      
      <CardContent className="p-6">
        <TooltipProvider>
          <div className="space-y-4" data-testid="container-task-list">
            {tasks.map((familyTask: FamilyTaskWithTaskAndDependencies) => {
              const isBlocked = familyTask.dependencyStatus && !familyTask.dependencyStatus.canStart && familyTask.status !== 'completed';
              return (
                <div
                  key={familyTask.id}
                  className={`flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 p-4 rounded-lg border transition-all ${
                    isBlocked ? 'bg-muted/15 border-muted/50 opacity-75' : 'bg-muted/30 border-border'
                  }`}
                  data-testid={`task-item-${familyTask.id}`}
                >
                  <div className="flex-shrink-0 pt-1">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      isBlocked ? 'bg-muted border border-muted-foreground' : 'bg-primary'
                    }`}>
                      {isBlocked ? <Lock className="w-3 h-3 text-muted-foreground" /> : getStatusIcon(familyTask.status)}
                    </div>
                  </div>
              
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-medium mb-1 break-words ${
                      isBlocked ? 'text-muted-foreground' : 'text-card-foreground'
                    }`} data-testid={`text-task-title-${familyTask.id}`}>
                      {familyTask.task.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3 break-words sm:line-clamp-none line-clamp-3" data-testid={`text-task-description-${familyTask.id}`}>
                      {familyTask.task.description}
                    </p>
                    
                    {/* Dependency Status Indicator */}
                    {getDependencyStatusIndicator(familyTask)}
                
                    <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div data-testid={`badge-task-status-${familyTask.id}`}>
                        {getStatusBadge(familyTask.status)}
                      </div>
                  
                      <div className="flex flex-wrap gap-2">
                        {familyTask.status === "not_started" && (
                          isBlocked ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={true}
                                  data-testid={`button-start-task-${familyTask.id}`}
                                  aria-label="Prerequisites Required"
                                >
                                  <Lock className="w-3 h-3 mr-1" />
                                  <span className="hidden sm:inline">Prerequisites Required</span>
                                  <span className="sm:hidden">Blocked</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {getBlockedTooltipContent(familyTask.dependencyStatus?.blockedBy || [])}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusChange(familyTask.id, "in_progress")}
                              disabled={updateTaskMutation.isPending}
                              data-testid={`button-start-task-${familyTask.id}`}
                            >
                              Start Task
                            </Button>
                          )
                        )}
                    
                        {familyTask.status === "in_progress" && (
                          <>
                            <ObjectUploader
                              maxNumberOfFiles={5}
                              maxFileSize={10485760} // 10MB
                              onGetUploadParameters={handleGetUploadParameters}
                              onComplete={handleUploadComplete}
                              buttonClassName="text-primary hover:text-primary/80 h-8 px-3 text-sm"
                            >
                              <Upload className="w-4 h-4 mr-1" />
                              Upload Documents
                            </ObjectUploader>
                            {!familyTask.dependencyStatus?.canComplete ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    disabled={true}
                                    data-testid={`button-complete-task-${familyTask.id}`}
                                    aria-label="Complete Prerequisites First"
                                  >
                                    <Lock className="w-3 h-3 mr-1" />
                                    <span className="hidden sm:inline">Complete Prerequisites First</span>
                                    <span className="sm:hidden">Complete</span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {getBlockedTooltipContent(familyTask.dependencyStatus?.blockedBy || [])}
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleStatusChange(familyTask.id, "completed")}
                                disabled={updateTaskMutation.isPending}
                                data-testid={`button-complete-task-${familyTask.id}`}
                              >
                                Mark Complete
                              </Button>
                            )}
                          </>
                        )}
                    
                        {familyTask.status === "completed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-primary hover:text-primary/80"
                            data-testid={`button-view-documents-${familyTask.id}`}
                          >
                            View Documents
                          </Button>
                        )}
                      </div>
                    </div>
                
                    {familyTask.notes && (
                      <div className="mt-2 p-2 bg-muted/20 rounded text-sm text-muted-foreground" data-testid={`text-task-notes-${familyTask.id}`}>
                        <strong>Notes:</strong> {familyTask.notes}
                      </div>
                    )}
                    
                    {/* Dependency Information Panel */}
                    {getDependencyPanel(familyTask)}
                  </div>
                </div>
              );
            })}
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
