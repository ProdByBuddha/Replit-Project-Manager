import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, Settings, Search, Zap, ZapOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { WorkflowRuleWithNames } from "@/lib/types";
import type { Task, User } from "@shared/schema";

interface WorkflowRuleFormData {
  name: string;
  description: string;
  triggerCondition: 'task_completed' | 'all_dependencies_met' | 'status_change';
  triggerTaskId?: string;
  triggerStatus?: string;
  action: 'auto_enable' | 'auto_complete' | 'send_notification' | 'assign_user';
  targetType: 'task' | 'user';
  actionTargetTaskId?: string;
  actionTargetUserId?: string;
  isActive: boolean;
}

const TRIGGER_CONDITIONS = [
  { value: 'task_completed', label: 'Task Completed' },
  { value: 'all_dependencies_met', label: 'All Dependencies Met' },
  { value: 'status_change', label: 'Status Change' },
];

const ACTIONS = [
  { value: 'auto_enable', label: 'Auto Enable', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
  { value: 'auto_complete', label: 'Auto Complete', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
  { value: 'send_notification', label: 'Send Notification', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
  { value: 'assign_user', label: 'Assign User', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' },
];

const STATUS_OPTIONS = ['not_started', 'in_progress', 'completed'];

export default function WorkflowRulesManagement() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<WorkflowRuleWithNames | null>(null);
  const [deletingRule, setDeletingRule] = useState<WorkflowRuleWithNames | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState<WorkflowRuleFormData>({
    name: '',
    description: '',
    triggerCondition: 'task_completed',
    action: 'auto_enable',
    targetType: 'task',
    isActive: true,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch workflow rules
  const { data: workflowRules = [], isLoading: isRulesLoading } = useQuery<WorkflowRuleWithNames[]>({
    queryKey: ["/api/admin/workflow-rules"],
    retry: false,
  });

  // Fetch all tasks for dropdowns
  const { data: allTasks = [], isLoading: isTasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    retry: false,
  });

  // Fetch all users for workflow rule assignment
  const { data: allUsers = [], isLoading: isUsersLoading } = useQuery<Array<{id: string, name: string, email: string, role: string}>>({
    queryKey: ["/api/admin/users"],
    retry: false,
  });

  // Create workflow rule mutation
  const createRuleMutation = useMutation({
    mutationFn: (data: WorkflowRuleFormData) => apiRequest("/api/admin/workflow-rules", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/workflow-rules"] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Workflow rule created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create workflow rule.",
        variant: "destructive",
      });
    },
  });

  // Update workflow rule mutation
  const updateRuleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: WorkflowRuleFormData }) =>
      apiRequest(`/api/admin/workflow-rules/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/workflow-rules"] });
      setEditingRule(null);
      resetForm();
      toast({
        title: "Success",
        description: "Workflow rule updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update workflow rule.",
        variant: "destructive",
      });
    },
  });

  // Delete workflow rule mutation
  const deleteRuleMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/admin/workflow-rules/${id}`, {
      method: "DELETE",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/workflow-rules"] });
      setDeletingRule(null);
      toast({
        title: "Success",
        description: "Workflow rule deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete workflow rule.",
        variant: "destructive",
      });
    },
  });

  // Toggle workflow rule mutation
  const toggleRuleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest(`/api/admin/workflow-rules/${id}/toggle`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/workflow-rules"] });
      toast({
        title: "Success",
        description: "Workflow rule status updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update workflow rule status.",
        variant: "destructive",
      });
    },
  });

  // Filter rules based on search
  const filteredRules = workflowRules.filter(rule =>
    rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rule.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rule.triggerCondition.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rule.action.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      triggerCondition: 'task_completed',
      action: 'auto_enable',
      targetType: 'task',
      isActive: true,
    });
  };

  const handleAddRule = () => {
    resetForm();
    setIsAddDialogOpen(true);
  };

  const handleEditRule = (rule: WorkflowRuleWithNames) => {
    setFormData({
      name: rule.name,
      description: rule.description || '',
      triggerCondition: rule.triggerCondition as 'task_completed' | 'all_dependencies_met' | 'status_change',
      triggerTaskId: rule.triggerTaskId || undefined,
      triggerStatus: rule.triggerStatus || undefined,
      action: rule.action as 'auto_enable' | 'auto_complete' | 'send_notification' | 'assign_user',
      targetType: rule.targetType as 'task' | 'user',
      actionTargetTaskId: rule.actionTargetTaskId || undefined,
      actionTargetUserId: rule.actionTargetUserId || undefined,
      isActive: rule.isActive,
    });
    setEditingRule(rule);
  };

  const handleToggleRule = (rule: WorkflowRuleWithNames) => {
    toggleRuleMutation.mutate({ id: rule.id, isActive: !rule.isActive });
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Rule name is required.",
        variant: "destructive",
      });
      return;
    }

    // Validate trigger fields
    if (formData.triggerCondition === 'task_completed' && !formData.triggerTaskId) {
      toast({
        title: "Validation Error",
        description: "Please select a trigger task for task completed condition.",
        variant: "destructive",
      });
      return;
    }

    if (formData.triggerCondition === 'status_change' && (!formData.triggerTaskId || !formData.triggerStatus)) {
      toast({
        title: "Validation Error",
        description: "Please select both trigger task and status for status change condition.",
        variant: "destructive",
      });
      return;
    }

    // Validate action targets
    if (formData.targetType === 'task' && !formData.actionTargetTaskId) {
      toast({
        title: "Validation Error",
        description: "Please select a target task.",
        variant: "destructive",
      });
      return;
    }

    if (formData.targetType === 'user' && !formData.actionTargetUserId) {
      toast({
        title: "Validation Error",
        description: "Please select a target user.",
        variant: "destructive",
      });
      return;
    }

    if (editingRule) {
      updateRuleMutation.mutate({ id: editingRule.id, data: formData });
    } else {
      createRuleMutation.mutate(formData);
    }
  };

  const handleDelete = () => {
    if (deletingRule) {
      deleteRuleMutation.mutate(deletingRule.id);
    }
  };

  const getActionBadge = (action: string) => {
    const actionConfig = ACTIONS.find(a => a.value === action);
    return actionConfig ? actionConfig.color : "bg-gray-100 text-gray-800";
  };

  const shouldShowTriggerTaskField = () => {
    return formData.triggerCondition === 'task_completed' || formData.triggerCondition === 'status_change';
  };

  const shouldShowTriggerStatusField = () => {
    return formData.triggerCondition === 'status_change';
  };

  if (isRulesLoading || isTasksLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border">
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-primary" />
            <CardTitle className="text-card-foreground">Workflow Rules</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="animate-pulse">
            <div className="space-y-4 p-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="w-full h-16 bg-muted rounded" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <Settings className="w-5 h-5 text-primary" />
              <CardTitle className="text-card-foreground">Workflow Rules</CardTitle>
            </div>
            <Button
              onClick={handleAddRule}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="button-add-workflow-rule"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {/* Search */}
          <div className="flex items-center space-x-2 mb-6">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search workflow rules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
              data-testid="input-search-workflow-rules"
            />
          </div>

          {/* Workflow Rules Table */}
          {filteredRules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-workflow-rules">
              {searchQuery ? "No workflow rules match your search." : "No workflow rules configured."}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-3 sm:mx-0">
            <Table data-testid="table-workflow-rules">
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Rule Name</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRules.map((rule) => (
                  <TableRow key={rule.id} data-testid={`row-workflow-rule-${rule.id}`}>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleRule(rule)}
                        disabled={toggleRuleMutation.isPending}
                        data-testid={`button-toggle-rule-${rule.id}`}
                      >
                        {rule.isActive ? (
                          <Zap className="w-4 h-4 text-green-600" />
                        ) : (
                          <ZapOff className="w-4 h-4 text-gray-400" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div>
                        <div>{rule.name}</div>
                        {rule.description && (
                          <div className="text-xs text-muted-foreground">{rule.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs">
                        <div>{TRIGGER_CONDITIONS.find(t => t.value === rule.triggerCondition)?.label}</div>
                        {rule.triggerTaskName && (
                          <div className="text-muted-foreground">Task: {rule.triggerTaskName}</div>
                        )}
                        {rule.triggerStatus && (
                          <div className="text-muted-foreground">Status: {rule.triggerStatus}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={getActionBadge(rule.action)}
                        data-testid={`badge-action-${rule.id}`}
                      >
                        {ACTIONS.find(a => a.value === rule.action)?.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs">
                        <div>{rule.targetType}</div>
                        {rule.actionTargetTaskName && (
                          <div className="text-muted-foreground">Task: {rule.actionTargetTaskName}</div>
                        )}
                        {rule.actionTargetUserId && (
                          <div className="text-muted-foreground">User: {rule.actionTargetUserId}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(rule.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditRule(rule)}
                          data-testid={`button-edit-rule-${rule.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingRule(rule)}
                          className="text-destructive hover:text-destructive"
                          data-testid={`button-delete-rule-${rule.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog 
        open={isAddDialogOpen || !!editingRule} 
        onOpenChange={() => {
          setIsAddDialogOpen(false);
          setEditingRule(null);
          resetForm();
        }}
      >
        <DialogContent className="w-[95vw] max-w-2xl sm:w-full" data-testid="dialog-workflow-rule-form">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? 'Edit Workflow Rule' : 'Add Workflow Rule'}
            </DialogTitle>
            <DialogDescription>
              Configure automation rules to streamline task workflows.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4 max-h-96 overflow-y-auto">
            {/* Basic Info */}
            <div className="grid gap-2">
              <Label htmlFor="name">Rule Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="e.g., Auto-complete forms after documents uploaded"
                data-testid="input-rule-name"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Optional description of when and how this rule applies"
                data-testid="textarea-rule-description"
              />
            </div>

            {/* Trigger Configuration */}
            <div className="grid gap-2">
              <Label htmlFor="triggerCondition">Trigger Condition</Label>
              <Select
                value={formData.triggerCondition}
                onValueChange={(value) => setFormData({...formData, triggerCondition: value as any, triggerTaskId: '', triggerStatus: ''})}
              >
                <SelectTrigger data-testid="select-trigger-condition">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_CONDITIONS.map((trigger) => (
                    <SelectItem key={trigger.value} value={trigger.value}>
                      {trigger.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {shouldShowTriggerTaskField() && (
              <div className="grid gap-2">
                <Label htmlFor="triggerTask">Trigger Task</Label>
                <Select
                  value={formData.triggerTaskId || ''}
                  onValueChange={(value) => setFormData({...formData, triggerTaskId: value})}
                >
                  <SelectTrigger data-testid="select-trigger-task">
                    <SelectValue placeholder="Select trigger task" />
                  </SelectTrigger>
                  <SelectContent>
                    {allTasks.map((task) => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {shouldShowTriggerStatusField() && (
              <div className="grid gap-2">
                <Label htmlFor="triggerStatus">Trigger Status</Label>
                <Select
                  value={formData.triggerStatus || ''}
                  onValueChange={(value) => setFormData({...formData, triggerStatus: value})}
                >
                  <SelectTrigger data-testid="select-trigger-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Action Configuration */}
            <div className="grid gap-2">
              <Label htmlFor="action">Action</Label>
              <Select
                value={formData.action}
                onValueChange={(value) => setFormData({...formData, action: value as any, actionTargetTaskId: '', actionTargetUserId: ''})}
              >
                <SelectTrigger data-testid="select-action">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIONS.map((action) => (
                    <SelectItem key={action.value} value={action.value}>
                      {action.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="targetType">Target Type</Label>
              <Select
                value={formData.targetType}
                onValueChange={(value) => setFormData({...formData, targetType: value as 'task' | 'user', actionTargetTaskId: '', actionTargetUserId: ''})}
              >
                <SelectTrigger data-testid="select-target-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.targetType === 'task' && (
              <div className="grid gap-2">
                <Label htmlFor="actionTargetTask">Target Task</Label>
                <Select
                  value={formData.actionTargetTaskId || ''}
                  onValueChange={(value) => setFormData({...formData, actionTargetTaskId: value})}
                >
                  <SelectTrigger data-testid="select-action-target-task">
                    <SelectValue placeholder="Select target task" />
                  </SelectTrigger>
                  <SelectContent>
                    {allTasks.map((task) => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.targetType === 'user' && (
              <div className="grid gap-2">
                <Label htmlFor="actionTargetUser">Target User</Label>
                <Input
                  value={formData.actionTargetUserId || ''}
                  onChange={(e) => setFormData({...formData, actionTargetUserId: e.target.value})}
                  placeholder="Enter user ID or email"
                  data-testid="input-action-target-user"
                />
              </div>
            )}

            {/* Active Status */}
            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({...formData, isActive: checked})}
                data-testid="switch-rule-active"
              />
              <Label htmlFor="isActive">Rule is active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false);
                setEditingRule(null);
                resetForm();
              }}
              data-testid="button-cancel-rule"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createRuleMutation.isPending || updateRuleMutation.isPending}
              data-testid="button-save-rule"
            >
              {createRuleMutation.isPending || updateRuleMutation.isPending ? (
                "Saving..."
              ) : (
                editingRule ? "Update" : "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingRule}
        onOpenChange={() => setDeletingRule(null)}
      >
        <AlertDialogContent data-testid="dialog-delete-workflow-rule">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workflow Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this workflow rule? This action cannot be undone and may affect automation workflows.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-rule">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteRuleMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-rule"
            >
              {deleteRuleMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}