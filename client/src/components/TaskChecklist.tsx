import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Check, Clock, Upload } from "lucide-react";
import type { FamilyTaskWithTask } from "@/lib/types";

interface TaskChecklistProps {
  familyId?: string;
}

export default function TaskChecklist({ familyId }: TaskChecklistProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery<FamilyTaskWithTask[]>({
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
        <div className="space-y-4" data-testid="container-task-list">
          {tasks.map((familyTask: any) => (
            <div
              key={familyTask.id}
              className="flex items-start space-x-4 p-4 bg-muted/30 rounded-lg border border-border"
              data-testid={`task-item-${familyTask.id}`}
            >
              <div className="flex-shrink-0 pt-1">
                <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                  {getStatusIcon(familyTask.status)}
                </div>
              </div>
              
              <div className="flex-1">
                <h3 className="font-medium text-card-foreground mb-1" data-testid={`text-task-title-${familyTask.id}`}>
                  {familyTask.task.title}
                </h3>
                <p className="text-sm text-muted-foreground mb-3" data-testid={`text-task-description-${familyTask.id}`}>
                  {familyTask.task.description}
                </p>
                
                <div className="flex items-center justify-between">
                  <div data-testid={`badge-task-status-${familyTask.id}`}>
                    {getStatusBadge(familyTask.status)}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {familyTask.status === "not_started" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusChange(familyTask.id, "in_progress")}
                        disabled={updateTaskMutation.isPending}
                        data-testid={`button-start-task-${familyTask.id}`}
                      >
                        Start Task
                      </Button>
                    )}
                    
                    {familyTask.status === "in_progress" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-primary hover:text-primary/80"
                          data-testid={`button-upload-documents-${familyTask.id}`}
                        >
                          <Upload className="w-4 h-4 mr-1" />
                          Upload Documents
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleStatusChange(familyTask.id, "completed")}
                          disabled={updateTaskMutation.isPending}
                          data-testid={`button-complete-task-${familyTask.id}`}
                        >
                          Mark Complete
                        </Button>
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
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
