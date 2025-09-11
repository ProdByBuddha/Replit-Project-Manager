import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Edit, Trash2, Network, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { TaskDependencyWithNames } from "@/lib/types";
import type { Task } from "@shared/schema";

interface DependencyFormData {
  taskId: string;
  dependsOnTaskId: string;
  dependencyType: 'required' | 'optional' | 'sequential';
}

export default function DependencyManagement() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingDependency, setEditingDependency] = useState<TaskDependencyWithNames | null>(null);
  const [deletingDependency, setDeletingDependency] = useState<TaskDependencyWithNames | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState<DependencyFormData>({
    taskId: '',
    dependsOnTaskId: '',
    dependencyType: 'required'
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch dependencies
  const { data: dependencies = [], isLoading: isDependenciesLoading } = useQuery<TaskDependencyWithNames[]>({
    queryKey: ["/api/admin/dependencies"],
    retry: false,
  });

  // Fetch all tasks for dropdowns
  const { data: allTasks = [], isLoading: isTasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    retry: false,
  });

  // Create dependency mutation
  const createDependencyMutation = useMutation({
    mutationFn: (data: DependencyFormData) => apiRequest("/api/admin/dependencies", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dependencies"] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Task dependency created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create dependency.",
        variant: "destructive",
      });
    },
  });

  // Update dependency mutation
  const updateDependencyMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: DependencyFormData }) =>
      apiRequest(`/api/admin/dependencies/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dependencies"] });
      setEditingDependency(null);
      resetForm();
      toast({
        title: "Success",
        description: "Task dependency updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update dependency.",
        variant: "destructive",
      });
    },
  });

  // Delete dependency mutation
  const deleteDependencyMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/admin/dependencies/${id}`, {
      method: "DELETE",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dependencies"] });
      setDeletingDependency(null);
      toast({
        title: "Success",
        description: "Task dependency deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete dependency.",
        variant: "destructive",
      });
    },
  });

  // Filter dependencies based on search
  const filteredDependencies = dependencies.filter(dep =>
    dep.taskName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    dep.dependsOnTaskName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    dep.dependencyType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const resetForm = () => {
    setFormData({
      taskId: '',
      dependsOnTaskId: '',
      dependencyType: 'required'
    });
  };

  const handleAddDependency = () => {
    resetForm();
    setIsAddDialogOpen(true);
  };

  const handleEditDependency = (dependency: TaskDependencyWithNames) => {
    setFormData({
      taskId: dependency.taskId,
      dependsOnTaskId: dependency.dependsOnTaskId,
      dependencyType: dependency.dependencyType as 'required' | 'optional' | 'sequential'
    });
    setEditingDependency(dependency);
  };

  const handleSubmit = () => {
    if (!formData.taskId || !formData.dependsOnTaskId) {
      toast({
        title: "Validation Error",
        description: "Please select both task and dependency.",
        variant: "destructive",
      });
      return;
    }

    if (formData.taskId === formData.dependsOnTaskId) {
      toast({
        title: "Validation Error",
        description: "A task cannot depend on itself.",
        variant: "destructive",
      });
      return;
    }

    // Advanced circular dependency detection
    const detectCircularDependency = (newTaskId: string, newDependsOnTaskId: string): boolean => {
      // Build dependency graph from current dependencies
      const graph = new Map<string, string[]>();
      dependencies.forEach(dep => {
        if (!graph.has(dep.taskId)) graph.set(dep.taskId, []);
        graph.get(dep.taskId)!.push(dep.dependsOnTaskId);
      });
      
      // Add the potential new dependency (temporarily for validation)
      if (!graph.has(newTaskId)) graph.set(newTaskId, []);
      const existingDeps = graph.get(newTaskId) || [];
      
      // Skip if this exact dependency already exists (for updates)
      if (editingDependency && 
          editingDependency.taskId === newTaskId && 
          editingDependency.dependsOnTaskId === newDependsOnTaskId) {
        return false;
      }
      
      graph.set(newTaskId, [...existingDeps, newDependsOnTaskId]);
      
      // Check for cycles using DFS
      const visited = new Set<string>();
      const recursionStack = new Set<string>();
      
      const hasCycleDFS = (nodeId: string): boolean => {
        if (recursionStack.has(nodeId)) return true; // Back edge found - cycle exists
        if (visited.has(nodeId)) return false; // Already processed
        
        visited.add(nodeId);
        recursionStack.add(nodeId);
        
        const neighbors = graph.get(nodeId) || [];
        for (const neighbor of neighbors) {
          if (hasCycleDFS(neighbor)) return true;
        }
        
        recursionStack.delete(nodeId);
        return false;
      };
      
      // Check all nodes in the graph for cycles
      for (const nodeId of graph.keys()) {
        visited.clear();
        recursionStack.clear();
        if (hasCycleDFS(nodeId)) {
          return true;
        }
      }
      
      return false;
    };

    // Validate for circular dependencies
    if (detectCircularDependency(formData.taskId, formData.dependsOnTaskId)) {
      const taskName = allTasks.find(t => t.id === formData.taskId)?.title || 'Unknown Task';
      const dependsOnTaskName = allTasks.find(t => t.id === formData.dependsOnTaskId)?.title || 'Unknown Task';
      
      toast({
        title: "Circular Dependency Detected",
        description: `Adding "${taskName}" → "${dependsOnTaskName}" would create a circular dependency chain. This would prevent tasks from being completed properly.`,
        variant: "destructive",
      });
      return;
    }

    if (editingDependency) {
      updateDependencyMutation.mutate({ id: editingDependency.id, data: formData });
    } else {
      createDependencyMutation.mutate(formData);
    }
  };

  const handleDelete = () => {
    if (deletingDependency) {
      deleteDependencyMutation.mutate(deletingDependency.id);
    }
  };

  const getDependencyTypeBadge = (type: string) => {
    const colors = {
      required: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
      optional: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
      sequential: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
    };
    return colors[type as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  if (isDependenciesLoading || isTasksLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border">
          <div className="flex items-center space-x-2">
            <Network className="w-5 h-5 text-primary" />
            <CardTitle className="text-card-foreground">Task Dependencies</CardTitle>
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
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Network className="w-5 h-5 text-primary" />
              <CardTitle className="text-card-foreground">Task Dependencies</CardTitle>
            </div>
            <Button
              onClick={handleAddDependency}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="button-add-dependency"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Dependency
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {/* Search */}
          <div className="flex items-center space-x-2 mb-6">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search dependencies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
              data-testid="input-search-dependencies"
            />
          </div>

          {/* Dependencies Table */}
          {filteredDependencies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-dependencies">
              {searchQuery ? "No dependencies match your search." : "No task dependencies configured."}
            </div>
          ) : (
            <Table data-testid="table-dependencies">
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Depends On</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDependencies.map((dependency) => (
                  <TableRow key={dependency.id} data-testid={`row-dependency-${dependency.id}`}>
                    <TableCell className="font-medium">
                      {dependency.taskName}
                    </TableCell>
                    <TableCell>{dependency.dependsOnTaskName}</TableCell>
                    <TableCell>
                      <Badge
                        className={getDependencyTypeBadge(dependency.dependencyType)}
                        data-testid={`badge-dependency-type-${dependency.id}`}
                      >
                        {dependency.dependencyType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(dependency.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditDependency(dependency)}
                          data-testid={`button-edit-dependency-${dependency.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingDependency(dependency)}
                          className="text-destructive hover:text-destructive"
                          data-testid={`button-delete-dependency-${dependency.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog 
        open={isAddDialogOpen || !!editingDependency} 
        onOpenChange={() => {
          setIsAddDialogOpen(false);
          setEditingDependency(null);
          resetForm();
        }}
      >
        <DialogContent data-testid="dialog-dependency-form">
          <DialogHeader>
            <DialogTitle>
              {editingDependency ? 'Edit Dependency' : 'Add Task Dependency'}
            </DialogTitle>
            <DialogDescription>
              Configure which tasks must be completed before others can be started.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="task">Task</Label>
              <Select
                value={formData.taskId}
                onValueChange={(value) => setFormData({...formData, taskId: value})}
              >
                <SelectTrigger data-testid="select-task">
                  <SelectValue placeholder="Select task" />
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

            <div className="grid gap-2">
              <Label htmlFor="dependsOn">Depends On</Label>
              <Select
                value={formData.dependsOnTaskId}
                onValueChange={(value) => setFormData({...formData, dependsOnTaskId: value})}
              >
                <SelectTrigger data-testid="select-depends-on-task">
                  <SelectValue placeholder="Select dependency" />
                </SelectTrigger>
                <SelectContent>
                  {allTasks
                    .filter(task => task.id !== formData.taskId) // Prevent self-dependency
                    .map((task) => (
                    <SelectItem key={task.id} value={task.id}>
                      {task.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="type">Dependency Type</Label>
              <Select
                value={formData.dependencyType}
                onValueChange={(value) => setFormData({...formData, dependencyType: value as 'required' | 'optional' | 'sequential'})}
              >
                <SelectTrigger data-testid="select-dependency-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="required">Required</SelectItem>
                  <SelectItem value="optional">Optional</SelectItem>
                  <SelectItem value="sequential">Sequential</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false);
                setEditingDependency(null);
                resetForm();
              }}
              data-testid="button-cancel-dependency"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createDependencyMutation.isPending || updateDependencyMutation.isPending}
              data-testid="button-save-dependency"
            >
              {createDependencyMutation.isPending || updateDependencyMutation.isPending ? (
                "Saving..."
              ) : (
                editingDependency ? "Update" : "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingDependency}
        onOpenChange={() => setDeletingDependency(null)}
      >
        <AlertDialogContent data-testid="dialog-delete-dependency">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Dependency</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this dependency? This action cannot be undone and may affect task workflows.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteDependencyMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteDependencyMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}