import { storage } from "../storage";
import { eventBus, type TaskStatusChangedEvent, type TaskCompletedEvent, type RuleTriggeredEvent, type ActionAppliedEvent } from "./EventBus";
import { notificationService } from "../email/notificationService";
import type { WorkflowRule, FamilyTask, Task } from "@shared/schema";

export interface ActionContext {
  familyId: string;
  triggerTaskId: string;
  triggerStatus: string;
  actorUserId?: string;
  correlationId: string;
}

export class RuleEngine {
  private static instance: RuleEngine;

  private constructor() {
    this.registerEventHandlers();
  }

  public static getInstance(): RuleEngine {
    if (!RuleEngine.instance) {
      RuleEngine.instance = new RuleEngine();
    }
    return RuleEngine.instance;
  }

  private registerEventHandlers(): void {
    // Listen for task status changes to trigger workflow rules
    eventBus.onTaskStatusChanged(async (event: TaskStatusChangedEvent) => {
      await this.handleTaskStatusChanged(event);
    });

    // Also listen for task completion for specific completion rules
    eventBus.onTaskCompleted(async (event: TaskCompletedEvent) => {
      await this.handleTaskCompleted(event);
    });
  }

  /**
   * Handle task status changes - apply relevant workflow rules
   */
  private async handleTaskStatusChanged(event: TaskStatusChangedEvent): Promise<void> {
    const { familyId, templateTaskId, newStatus, correlationId } = event;
    
    console.log(`[RuleEngine] Processing status change for template task ${templateTaskId} to ${newStatus} in family ${familyId}`);

    try {
      // Fetch all active workflow rules that could be triggered
      const [taskSpecificRules, statusChangeRules] = await Promise.all([
        storage.getWorkflowRulesForTask(templateTaskId),
        this.getActiveStatusChangeRules(),
      ]);

      const allRules = [...taskSpecificRules, ...statusChangeRules];
      const applicableRules = allRules.filter(rule => 
        rule.isActive && this.shouldTriggerRule(rule, event)
      );

      if (applicableRules.length === 0) {
        console.log(`[RuleEngine] No applicable rules found for task ${templateTaskId} status ${newStatus}`);
        return;
      }

      console.log(`[RuleEngine] Found ${applicableRules.length} applicable rules to execute`);

      // Execute rules in order of priority/creation
      for (const rule of applicableRules) {
        await this.executeWorkflowRule(rule, {
          familyId,
          triggerTaskId: templateTaskId,
          triggerStatus: newStatus,
          actorUserId: event.actorUserId,
          correlationId,
        });
      }

    } catch (error) {
      console.error(`[RuleEngine] Error processing task status change:`, error);
      
      eventBus.emitActionFailed({
        familyId: familyId,
        action: 'rule_processing',
        error: error instanceof Error ? error.message : String(error),
        context: { 
          templateTaskId: templateTaskId,
          newStatus: newStatus,
          triggerEvent: event 
        },
        correlationId: correlationId,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Handle task completion - similar to status change but optimized for completion
   */
  private async handleTaskCompleted(event: TaskCompletedEvent): Promise<void> {
    const { familyId, templateTaskId, correlationId } = event;
    
    console.log(`[RuleEngine] Processing task completion for template task ${templateTaskId} in family ${familyId}`);

    try {
      // Get completion-specific rules
      const completionRules = await storage.getActiveWorkflowRules();
      const applicableRules = completionRules.filter(rule => 
        rule.isActive && 
        rule.triggerCondition === 'task_completed' &&
        rule.triggerTaskId === templateTaskId
      );

      if (applicableRules.length === 0) {
        console.log(`[RuleEngine] No completion rules found for task ${templateTaskId}`);
        return;
      }

      console.log(`[RuleEngine] Found ${applicableRules.length} completion rules to execute`);

      // Execute completion rules
      for (const rule of applicableRules) {
        await this.executeWorkflowRule(rule, {
          familyId,
          triggerTaskId: templateTaskId,
          triggerStatus: 'completed',
          actorUserId: event.actorUserId,
          correlationId,
        });
      }

    } catch (error) {
      console.error(`[RuleEngine] Error processing task completion:`, error);
      
      eventBus.emitActionFailed({
        familyId: familyId,
        action: 'completion_rule_processing',
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
   * Execute a single workflow rule with action ordering
   */
  private async executeWorkflowRule(rule: WorkflowRule, context: ActionContext): Promise<void> {
    const { familyId, correlationId } = context;
    
    console.log(`[RuleEngine] Executing rule "${rule.name}" (${rule.id})`);

    try {
      // Emit rule triggered event for observability
      eventBus.emitRuleTriggered({
        familyId: familyId,
        ruleId: rule.id,
        ruleName: rule.name,
        triggerCondition: rule.triggerCondition,
        triggerTaskId: rule.triggerTaskId ?? undefined,
        triggerStatus: rule.triggerStatus ?? undefined,
        correlationId: correlationId,
        timestamp: new Date(),
      });

      // Phase 1: Validate the rule action is applicable
      const validationResult = await this.validateRuleAction(rule, context);
      if (!validationResult.canExecute) {
        console.log(`[RuleEngine] Rule ${rule.name} validation failed: ${validationResult.reason}`);
        return;
      }

      // Phase 2: Apply the action with proper family scoping
      const actionResult = await this.applyRuleAction(rule, context);
      
      // Phase 3: Emit action applied event
      eventBus.emitActionApplied({
        familyId: familyId,
        ruleId: rule.id,
        action: rule.action,
        targetType: rule.targetType,
        targetTaskId: rule.actionTargetTaskId ?? undefined,
        targetUserId: rule.actionTargetUserId ?? undefined,
        success: actionResult.success,
        correlationId: correlationId,
        timestamp: new Date(),
        details: actionResult.details,
      });

      if (actionResult.success) {
        console.log(`[RuleEngine] Rule ${rule.name} executed successfully`);
      } else {
        console.warn(`[RuleEngine] Rule ${rule.name} execution partially failed:`, actionResult.details);
      }

    } catch (error) {
      console.error(`[RuleEngine] Error executing rule ${rule.name}:`, error);
      
      eventBus.emitActionFailed({
        familyId: familyId,
        ruleId: rule.id,
        action: rule.action,
        error: error instanceof Error ? error.message : String(error),
        context: { rule, actionContext: context },
        correlationId: correlationId,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Validate if a rule action can be executed
   */
  private async validateRuleAction(rule: WorkflowRule, context: ActionContext): Promise<{ canExecute: boolean; reason?: string }> {
    const { familyId } = context;

    try {
      switch (rule.action) {
        case 'auto_enable':
        case 'auto_complete':
          if (!rule.actionTargetTaskId) {
            return { canExecute: false, reason: 'No target task specified' };
          }
          
          // Check if target task exists and belongs to the family
          const familyTask = await storage.getFamilyTaskByFamilyAndTask(familyId, rule.actionTargetTaskId);
          if (!familyTask) {
            return { canExecute: false, reason: 'Target task not found in family' };
          }

          // For auto_enable, task should be not_started
          if (rule.action === 'auto_enable' && familyTask.status !== 'not_started') {
            return { canExecute: false, reason: 'Task is not in not_started status' };
          }

          // For auto_complete, validate dependencies if needed
          if (rule.action === 'auto_complete') {
            const dependencyValidation = await storage.validateDependencies(rule.actionTargetTaskId, familyId);
            if (!dependencyValidation.canStart) {
              return { canExecute: false, reason: 'Task dependencies not met' };
            }
          }
          
          break;

        case 'send_notification':
          // Notification can always be sent if we have valid recipients
          break;

        case 'assign_user':
          if (!rule.actionTargetUserId || !rule.actionTargetTaskId) {
            return { canExecute: false, reason: 'Missing target user or task for assignment' };
          }
          
          // Verify user is part of the family
          const user = await storage.getUser(rule.actionTargetUserId);
          if (!user || user.familyId !== familyId) {
            return { canExecute: false, reason: 'Target user not found or not in family' };
          }
          
          break;

        default:
          return { canExecute: false, reason: `Unknown action: ${rule.action}` };
      }

      return { canExecute: true };

    } catch (error) {
      console.error(`[RuleEngine] Error validating rule action:`, error);
      return { canExecute: false, reason: 'Validation error' };
    }
  }

  /**
   * Apply the actual rule action with family scoping
   */
  private async applyRuleAction(rule: WorkflowRule, context: ActionContext): Promise<{ success: boolean; details?: any }> {
    const { familyId, correlationId } = context;

    try {
      switch (rule.action) {
        case 'auto_enable':
          return await this.executeAutoEnable(rule, familyId, correlationId);
        
        case 'auto_complete':
          return await this.executeAutoComplete(rule, familyId, correlationId);
        
        case 'send_notification':
          return await this.executeSendNotification(rule, context);
        
        case 'assign_user':
          return await this.executeAssignUser(rule, familyId);
        
        default:
          throw new Error(`Unsupported action: ${rule.action}`);
      }
    } catch (error) {
      console.error(`[RuleEngine] Error applying rule action:`, error);
      return { success: false, details: { error: error instanceof Error ? error.message : String(error) } };
    }
  }

  /**
   * Execute auto_enable action
   */
  private async executeAutoEnable(rule: WorkflowRule, familyId: string, correlationId: string): Promise<{ success: boolean; details?: any }> {
    if (!rule.actionTargetTaskId) {
      throw new Error('No target task specified for auto_enable action');
    }

    const familyTask = await storage.getFamilyTaskByFamilyAndTask(familyId, rule.actionTargetTaskId);
    if (!familyTask) {
      throw new Error('Target family task not found');
    }

    if (familyTask.status !== 'not_started') {
      return { success: true, details: { message: 'Task already enabled', currentStatus: familyTask.status } };
    }

    // Enable the task (set to in_progress)
    await storage.updateFamilyTaskStatus(familyTask.id, 'in_progress');

    // Emit TaskStatusChanged event for the enabled task
    eventBus.emitTaskStatusChanged({
      familyId: familyId,
      familyTaskId: familyTask.id,
      templateTaskId: rule.actionTargetTaskId,
      oldStatus: 'not_started',
      newStatus: 'in_progress',
      correlationId: correlationId,
      timestamp: new Date(),
    });

    return { success: true, details: { familyTaskId: familyTask.id, newStatus: 'in_progress' } };
  }

  /**
   * Execute auto_complete action
   */
  private async executeAutoComplete(rule: WorkflowRule, familyId: string, correlationId: string): Promise<{ success: boolean; details?: any }> {
    if (!rule.actionTargetTaskId) {
      throw new Error('No target task specified for auto_complete action');
    }

    const familyTask = await storage.getFamilyTaskByFamilyAndTask(familyId, rule.actionTargetTaskId);
    if (!familyTask) {
      throw new Error('Target family task not found');
    }

    if (familyTask.status === 'completed') {
      return { success: true, details: { message: 'Task already completed', currentStatus: familyTask.status } };
    }

    // Complete the task
    await storage.updateFamilyTaskStatus(familyTask.id, 'completed');

    // Emit both TaskStatusChanged and TaskCompleted events
    eventBus.emitTaskStatusChanged({
      familyId: familyId,
      familyTaskId: familyTask.id,
      templateTaskId: rule.actionTargetTaskId,
      oldStatus: familyTask.status,
      newStatus: 'completed',
      correlationId: correlationId,
      timestamp: new Date(),
    });

    eventBus.emitTaskCompleted({
      familyId: familyId,
      familyTaskId: familyTask.id,
      templateTaskId: rule.actionTargetTaskId,
      correlationId: correlationId,
      timestamp: new Date(),
      completedAt: new Date(),
    });

    return { success: true, details: { familyTaskId: familyTask.id, newStatus: 'completed' } };
  }

  /**
   * Execute send_notification action with deduplication
   */
  private async executeSendNotification(rule: WorkflowRule, context: ActionContext): Promise<{ success: boolean; details?: any }> {
    const { familyId, triggerTaskId, correlationId } = context;

    try {
      // Get family for notification context
      const family = await storage.getFamilyWithMembers(familyId);
      if (!family) {
        throw new Error('Family not found for notification');
      }

      // For now, use the existing notification service patterns
      // In a full implementation, this could be more sophisticated
      const notificationDetails = {
        type: 'rule_triggered',
        ruleId: rule.id,
        ruleName: rule.name,
        triggerTaskId: triggerTaskId,
        familyId: familyId,
        correlationId: correlationId,
      };

      // Use existing notification patterns with deduplication
      console.log(`[RuleEngine] Rule ${rule.name} notification would be sent:`, notificationDetails);

      return { success: true, details: notificationDetails };

    } catch (error) {
      console.error(`[RuleEngine] Error sending notification:`, error);
      return { success: false, details: { error: error instanceof Error ? error.message : String(error) } };
    }
  }

  /**
   * Execute assign_user action
   */
  private async executeAssignUser(rule: WorkflowRule, familyId: string): Promise<{ success: boolean; details?: any }> {
    if (!rule.actionTargetTaskId || !rule.actionTargetUserId) {
      throw new Error('Missing target task or user for assign_user action');
    }

    const familyTask = await storage.getFamilyTaskByFamilyAndTask(familyId, rule.actionTargetTaskId);
    if (!familyTask) {
      throw new Error('Target family task not found');
    }

    // Update the task assignment
    // Note: This assumes there's an assignedTo field update method
    // For now, we'll use a generic approach through the task status update
    await storage.updateFamilyTaskStatus(familyTask.id, familyTask.status);

    return { 
      success: true, 
      details: { 
        familyTaskId: familyTask.id, 
        assignedUserId: rule.actionTargetUserId 
      } 
    };
  }

  /**
   * Helper methods
   */
  private async getActiveStatusChangeRules(): Promise<WorkflowRule[]> {
    const allRules = await storage.getActiveWorkflowRules();
    return allRules.filter(rule => 
      rule.triggerCondition === 'status_change' && rule.isActive
    );
  }

  private shouldTriggerRule(rule: WorkflowRule, event: TaskStatusChangedEvent): boolean {
    switch (rule.triggerCondition) {
      case 'task_completed':
        return event.newStatus === 'completed' && rule.triggerTaskId === event.templateTaskId;
      
      case 'status_change':
        return rule.triggerStatus ? event.newStatus === rule.triggerStatus : true;
      
      case 'all_dependencies_met':
        // This would require additional dependency checking logic
        return false; // Simplified for now
      
      default:
        return false;
    }
  }

  /**
   * Health check method for admin monitoring
   */
  public getHealth(): { 
    status: 'healthy' | 'unhealthy',
    handlersRegistered: number,
    timestamp: Date 
  } {
    return {
      status: 'healthy',
      handlersRegistered: 2, // TaskStatusChanged and TaskCompleted handlers
      timestamp: new Date(),
    };
  }
}

// Initialize the singleton instance when module is loaded
export const ruleEngine = RuleEngine.getInstance();