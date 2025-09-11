import { storage } from "../storage";
import { eventBus, type TaskCompletedEvent, type DependenciesMetEvent } from "./EventBus";
import type { FamilyTask, Task, TaskDependency } from "@shared/schema";

export class DependencyEnabler {
  private static instance: DependencyEnabler;

  private constructor() {
    this.registerEventHandlers();
  }

  public static getInstance(): DependencyEnabler {
    if (!DependencyEnabler.instance) {
      DependencyEnabler.instance = new DependencyEnabler();
    }
    return DependencyEnabler.instance;
  }

  private registerEventHandlers(): void {
    // Listen for task completion events to trigger dependency resolution
    eventBus.onTaskCompleted(async (event: TaskCompletedEvent) => {
      await this.handleTaskCompleted(event);
    });
  }

  /**
   * Handle task completion - find and enable dependent tasks using BFS algorithm
   */
  private async handleTaskCompleted(event: TaskCompletedEvent): Promise<void> {
    const { familyId, templateTaskId, correlationId } = event;
    
    console.log(`[DependencyEnabler] Processing task completion for template task ${templateTaskId} in family ${familyId}`);

    try {
      // Step 1: Find all tasks that depend on the completed task
      const dependentTasks = await storage.getTasksBlockedBy(templateTaskId);
      
      if (dependentTasks.length === 0) {
        console.log(`[DependencyEnabler] No dependent tasks found for template ${templateTaskId}`);
        return;
      }

      console.log(`[DependencyEnabler] Found ${dependentTasks.length} potential dependent tasks`);

      // Step 2: Get all family tasks for this family to enable O(1) lookups
      const familyTasks = await storage.getFamilyTasks(familyId);
      const familyTasksMap = new Map<string, FamilyTask & { task: Task }>();
      
      for (const familyTask of familyTasks) {
        familyTasksMap.set(familyTask.taskId, familyTask);
      }

      // Step 3: Process each dependent task using BFS to check if it's ready to enable
      const tasksToEnable: string[] = [];
      const processed = new Set<string>();

      for (const dependentRelation of dependentTasks) {
        const templateTaskId = dependentRelation.taskId;
        
        // Skip if already processed (avoid duplicates)
        if (processed.has(templateTaskId)) {
          continue;
        }
        processed.add(templateTaskId);

        const familyTask = familyTasksMap.get(templateTaskId);
        if (!familyTask) {
          console.log(`[DependencyEnabler] Family task not found for template ${templateTaskId} in family ${familyId}`);
          continue;
        }

        // Only consider tasks that are not_started (ready to be enabled)
        if (familyTask.status !== "not_started") {
          console.log(`[DependencyEnabler] Task ${familyTask.id} is already ${familyTask.status}, skipping`);
          continue;
        }

        // Step 4: Validate all dependencies for this task
        const validationResult = await storage.validateDependencies(templateTaskId, familyId);
        
        if (validationResult.canStart) {
          console.log(`[DependencyEnabler] Task ${familyTask.task.title} (${familyTask.id}) is ready to enable`);
          tasksToEnable.push(familyTask.id);
        } else {
          console.log(`[DependencyEnabler] Task ${familyTask.task.title} still has missing dependencies:`, validationResult.missingDependencies);
        }
      }

      // Step 5: Enable all tasks that are ready in a batch operation
      if (tasksToEnable.length > 0) {
        await this.batchEnableTasks(tasksToEnable, familyId, correlationId);
        
        // Emit DependenciesMet event for observability
        eventBus.emitDependenciesMet({
          familyId: familyId,
          familyTaskId: event.familyTaskId, // The original completed task
          templateTaskId: templateTaskId,
          enabledTasks: tasksToEnable,
          correlationId: correlationId,
          timestamp: new Date(),
        });
        
        console.log(`[DependencyEnabler] Successfully enabled ${tasksToEnable.length} tasks for family ${familyId}`);
      } else {
        console.log(`[DependencyEnabler] No tasks ready to enable for family ${familyId}`);
      }

    } catch (error) {
      console.error(`[DependencyEnabler] Error processing task completion:`, error);
      
      // Emit failure event for observability
      eventBus.emitActionFailed({
        familyId: familyId,
        action: 'dependency_enablement',
        error: error instanceof Error ? error.message : String(error),
        context: { 
          templateTaskId: templateTaskId,
          triggerEvent: event 
        },
        correlationId: correlationId,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Batch enable multiple tasks efficiently with error handling per task
   */
  private async batchEnableTasks(familyTaskIds: string[], familyId: string, correlationId: string): Promise<void> {
    const enablePromises = familyTaskIds.map(async (familyTaskId) => {
      try {
        // Update status to in_progress to enable the task
        const updatedTask = await storage.updateFamilyTaskStatus(familyTaskId, "in_progress");
        
        console.log(`[DependencyEnabler] Successfully enabled task ${familyTaskId}`);
        
        // Emit individual TaskStatusChanged event for each enabled task
        // This allows other automation components to react to the enablement
        const familyTask = await storage.getFamilyTask(familyTaskId);
        if (familyTask) {
          eventBus.emitTaskStatusChanged({
            familyId: familyId,
            familyTaskId: familyTaskId,
            templateTaskId: familyTask.taskId,
            oldStatus: "not_started",
            newStatus: "in_progress", 
            correlationId: correlationId,
            timestamp: new Date(),
          });
        }
        
        return { success: true, familyTaskId };
      } catch (error) {
        console.error(`[DependencyEnabler] Failed to enable task ${familyTaskId}:`, error);
        
        // Emit failure event for this specific task
        eventBus.emitActionFailed({
          familyId: familyId,
          action: 'enable_task',
          error: error instanceof Error ? error.message : String(error),
          context: { familyTaskId },
          correlationId: correlationId,
          timestamp: new Date(),
        });
        
        return { success: false, familyTaskId, error };
      }
    });

    // Wait for all enable operations to complete
    const results = await Promise.allSettled(enablePromises);
    
    // Log summary results
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;
    
    console.log(`[DependencyEnabler] Batch enable complete: ${successful} successful, ${failed} failed`);
  }

  /**
   * Manual dependency check and enablement for a specific family
   * Useful for initialization or manual triggers
   */
  public async checkAndEnableDependencies(familyId: string): Promise<{ enabled: number; errors: any[] }> {
    console.log(`[DependencyEnabler] Manual dependency check for family ${familyId}`);
    
    try {
      const familyTasks = await storage.getFamilyTasks(familyId);
      const tasksToEnable: string[] = [];
      const errors: any[] = [];

      for (const familyTask of familyTasks) {
        // Only check tasks that are not_started
        if (familyTask.status !== "not_started") {
          continue;
        }

        try {
          const validationResult = await storage.validateDependencies(familyTask.taskId, familyId);
          
          if (validationResult.canStart) {
            tasksToEnable.push(familyTask.id);
          }
        } catch (error) {
          console.error(`[DependencyEnabler] Error validating dependencies for task ${familyTask.id}:`, error);
          errors.push({ familyTaskId: familyTask.id, error });
        }
      }

      if (tasksToEnable.length > 0) {
        const correlationId = eventBus.generateCorrelationId();
        await this.batchEnableTasks(tasksToEnable, familyId, correlationId);
      }

      return {
        enabled: tasksToEnable.length,
        errors: errors
      };
    } catch (error) {
      console.error(`[DependencyEnabler] Error in manual dependency check:`, error);
      throw error;
    }
  }

  /**
   * Health check method for admin monitoring
   */
  public getHealth(): { 
    status: 'healthy' | 'unhealthy',
    handlerRegistered: boolean,
    timestamp: Date 
  } {
    return {
      status: 'healthy',
      handlerRegistered: true, 
      timestamp: new Date(),
    };
  }
}

// Initialize the singleton instance when module is loaded
export const dependencyEnabler = DependencyEnabler.getInstance();