import { storage } from "./storage";

export interface ValidationResult {
  isValid: boolean;
  errorMessage?: string;
  incompleteDependencies?: string[];
  details?: {
    currentStatus: string;
    attemptedStatus: string;
    incompleteDependencies?: string[];
  };
}

export type TaskStatus = "not_started" | "in_progress" | "completed";

/**
 * Validates task status transitions to prevent invalid changes
 * that violate dependency rules
 */
export async function validateTaskTransition(
  familyTaskId: string,
  currentStatus: TaskStatus,
  newStatus: TaskStatus,
  familyId: string,
  bypassValidation: boolean = false
): Promise<ValidationResult> {
  // Always allow automation to bypass validation
  if (bypassValidation) {
    return { isValid: true };
  }

  // Always allow backward transitions (completed → in_progress, in_progress → not_started)
  if (isBackwardTransition(currentStatus, newStatus)) {
    return { isValid: true };
  }

  // Validate forward transitions based on dependencies
  try {
    const familyTask = await storage.getFamilyTask(familyTaskId);
    if (!familyTask) {
      return {
        isValid: false,
        errorMessage: "Task not found"
      };
    }

    // Validate dependencies for completion
    if (newStatus === "completed") {
      const dependencyValidation = await storage.validateDependencies(familyTask.taskId, familyId);
      
      if (!dependencyValidation.canStart) {
        return {
          isValid: false,
          errorMessage: "Cannot complete task - dependencies not met",
          incompleteDependencies: dependencyValidation.missingDependencies,
          details: {
            currentStatus,
            attemptedStatus: newStatus,
            incompleteDependencies: dependencyValidation.missingDependencies
          }
        };
      }
    }

    // Validate skip-ahead transitions (not_started → completed)
    if (currentStatus === "not_started" && newStatus === "completed") {
      const dependencyValidation = await storage.validateDependencies(familyTask.taskId, familyId);
      
      if (!dependencyValidation.canStart) {
        return {
          isValid: false,
          errorMessage: "Cannot jump to completed - please complete prerequisites first",
          incompleteDependencies: dependencyValidation.missingDependencies,
          details: {
            currentStatus,
            attemptedStatus: newStatus,
            incompleteDependencies: dependencyValidation.missingDependencies
          }
        };
      }
    }

    // For in_progress transitions, check if prerequisites are met
    if (newStatus === "in_progress" && currentStatus === "not_started") {
      const dependencyValidation = await storage.validateDependencies(familyTask.taskId, familyId);
      
      if (!dependencyValidation.canStart) {
        return {
          isValid: false,
          errorMessage: "Cannot start task - prerequisite tasks must be completed first",
          incompleteDependencies: dependencyValidation.missingDependencies,
          details: {
            currentStatus,
            attemptedStatus: newStatus,
            incompleteDependencies: dependencyValidation.missingDependencies
          }
        };
      }
    }

    return { isValid: true };

  } catch (error) {
    console.error("Error validating task transition:", error);
    return {
      isValid: false,
      errorMessage: "Validation error occurred"
    };
  }
}

/**
 * Validates that the task belongs to the specified family
 */
export async function validateFamilyTaskOwnership(
  familyTaskId: string,
  familyId: string
): Promise<boolean> {
  try {
    const familyTask = await storage.getFamilyTask(familyTaskId);
    return familyTask?.familyId === familyId;
  } catch (error) {
    console.error("Error validating task ownership:", error);
    return false;
  }
}

/**
 * Checks if a status transition is backward (allows these without validation)
 */
function isBackwardTransition(currentStatus: TaskStatus, newStatus: TaskStatus): boolean {
  const statusOrder = {
    "not_started": 0,
    "in_progress": 1,
    "completed": 2
  };

  return statusOrder[newStatus] < statusOrder[currentStatus];
}

/**
 * Gets user-friendly dependency names for error messages
 * Optimized to avoid O(N^2) performance by calling getAllTasks once
 */
export async function getDependencyTaskNames(taskIds: string[]): Promise<string[]> {
  try {
    if (taskIds.length === 0) {
      return [];
    }

    // Get all template tasks once, not N times
    const allTasks = await storage.getAllTasks();
    
    // Create lookup map for O(1) access
    const taskLookup = new Map(allTasks.map(task => [task.id, task.title]));
    
    // Map task IDs to names efficiently
    return taskIds.map(taskId => taskLookup.get(taskId) || `Task ${taskId}`);
  } catch (error) {
    console.error("Error getting dependency names:", error);
    return taskIds.map(id => `Task ${id}`);
  }
}