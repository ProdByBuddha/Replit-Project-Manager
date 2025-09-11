import { EventEmitter } from "events";
import { nanoid } from "nanoid";

// Event type definitions with comprehensive payloads
export interface TaskStatusChangedEvent {
  familyId: string;
  familyTaskId: string;
  templateTaskId: string;
  oldStatus: string;
  newStatus: string;
  actorUserId?: string;
  correlationId: string;
  timestamp: Date;
  notes?: string;
}

export interface TaskCompletedEvent {
  familyId: string;
  familyTaskId: string;
  templateTaskId: string;
  actorUserId?: string;
  correlationId: string;
  timestamp: Date;
  completedAt: Date;
}

export interface DependenciesMetEvent {
  familyId: string;
  familyTaskId: string;
  templateTaskId: string;
  enabledTasks: string[]; // Array of enabled familyTaskIds
  correlationId: string;
  timestamp: Date;
}

export interface RuleTriggeredEvent {
  familyId: string;
  ruleId: string;
  ruleName: string;
  triggerCondition: string;
  triggerTaskId?: string;
  triggerStatus?: string;
  correlationId: string;
  timestamp: Date;
}

export interface ActionAppliedEvent {
  familyId: string;
  ruleId: string;
  action: string;
  targetType: string;
  targetTaskId?: string;
  targetUserId?: string;
  success: boolean;
  correlationId: string;
  timestamp: Date;
  details?: any;
}

export interface ActionFailedEvent {
  familyId: string;
  ruleId?: string;
  action: string;
  error: string;
  context: any;
  correlationId: string;
  timestamp: Date;
  retryCount?: number;
}

// Event names for type safety
export const EventTypes = {
  TASK_STATUS_CHANGED: 'task:status:changed',
  TASK_COMPLETED: 'task:completed', 
  DEPENDENCIES_MET: 'dependencies:met',
  RULE_TRIGGERED: 'rule:triggered',
  ACTION_APPLIED: 'action:applied',
  ACTION_FAILED: 'action:failed',
} as const;

export type EventType = typeof EventTypes[keyof typeof EventTypes];

// EventBus class wrapping Node EventEmitter with structured logging and error handling
export class EventBus {
  private emitter: EventEmitter;
  private static instance: EventBus;
  
  private constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100); // Increase for multiple handlers
    
    // Global error handler for unhandled event errors
    this.emitter.on('error', (error) => {
      console.error('[EventBus] Unhandled event error:', error);
    });
  }

  // Singleton pattern for global access
  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  // Generic emit method with error handling
  private safeEmit(eventType: EventType, payload: any): void {
    try {
      const eventId = nanoid();
      console.log(`[EventBus] Emitting ${eventType} [${eventId}]:`, {
        correlationId: payload.correlationId,
        familyId: payload.familyId,
        timestamp: payload.timestamp || new Date(),
      });
      
      this.emitter.emit(eventType, payload);
    } catch (error) {
      console.error(`[EventBus] Error emitting ${eventType}:`, error);
      // Emit error event for observability
      this.emitter.emit('error', { eventType, payload, error });
    }
  }

  // Type-safe emit methods for each event type
  public emitTaskStatusChanged(payload: TaskStatusChangedEvent): void {
    this.safeEmit(EventTypes.TASK_STATUS_CHANGED, {
      ...payload,
      timestamp: payload.timestamp || new Date(),
    });
  }

  public emitTaskCompleted(payload: TaskCompletedEvent): void {
    this.safeEmit(EventTypes.TASK_COMPLETED, {
      ...payload,
      timestamp: payload.timestamp || new Date(),
    });
  }

  public emitDependenciesMet(payload: DependenciesMetEvent): void {
    this.safeEmit(EventTypes.DEPENDENCIES_MET, {
      ...payload,
      timestamp: payload.timestamp || new Date(),
    });
  }

  public emitRuleTriggered(payload: RuleTriggeredEvent): void {
    this.safeEmit(EventTypes.RULE_TRIGGERED, {
      ...payload,
      timestamp: payload.timestamp || new Date(),
    });
  }

  public emitActionApplied(payload: ActionAppliedEvent): void {
    this.safeEmit(EventTypes.ACTION_APPLIED, {
      ...payload,
      timestamp: payload.timestamp || new Date(),
    });
  }

  public emitActionFailed(payload: ActionFailedEvent): void {
    this.safeEmit(EventTypes.ACTION_FAILED, {
      ...payload,
      timestamp: payload.timestamp || new Date(),
    });
  }

  // Registration methods for event handlers with error wrapping
  public onTaskStatusChanged(handler: (event: TaskStatusChangedEvent) => Promise<void> | void): void {
    this.emitter.on(EventTypes.TASK_STATUS_CHANGED, this.wrapHandler(handler));
  }

  public onTaskCompleted(handler: (event: TaskCompletedEvent) => Promise<void> | void): void {
    this.emitter.on(EventTypes.TASK_COMPLETED, this.wrapHandler(handler));
  }

  public onDependenciesMet(handler: (event: DependenciesMetEvent) => Promise<void> | void): void {
    this.emitter.on(EventTypes.DEPENDENCIES_MET, this.wrapHandler(handler));
  }

  public onRuleTriggered(handler: (event: RuleTriggeredEvent) => Promise<void> | void): void {
    this.emitter.on(EventTypes.RULE_TRIGGERED, this.wrapHandler(handler));
  }

  public onActionApplied(handler: (event: ActionAppliedEvent) => Promise<void> | void): void {
    this.emitter.on(EventTypes.ACTION_APPLIED, this.wrapHandler(handler));
  }

  public onActionFailed(handler: (event: ActionFailedEvent) => Promise<void> | void): void {
    this.emitter.on(EventTypes.ACTION_FAILED, this.wrapHandler(handler));
  }

  // Wrap handlers with error handling to prevent crashes
  private wrapHandler(handler: Function) {
    return async (payload: any) => {
      try {
        await handler(payload);
      } catch (error) {
        console.error('[EventBus] Handler error:', error, 'Payload:', payload);
        
        // Emit failure event for observability
        this.emitActionFailed({
          familyId: payload.familyId || 'unknown',
          action: 'event_handler',
          error: error instanceof Error ? error.message : String(error),
          context: { originalEvent: payload },
          correlationId: payload.correlationId || nanoid(),
          timestamp: new Date(),
        });
      }
    };
  }

  // Utility method to generate correlation IDs
  public generateCorrelationId(): string {
    return nanoid();
  }

  // Health check method for admin monitoring
  public getEventBusHealth(): { 
    status: 'healthy' | 'unhealthy', 
    listenerCount: number,
    maxListeners: number,
    timestamp: Date 
  } {
    return {
      status: 'healthy',
      listenerCount: this.emitter.listenerCount('newListener'), 
      maxListeners: this.emitter.getMaxListeners(),
      timestamp: new Date(),
    };
  }

  // For testing - remove all listeners
  public removeAllListeners(): void {
    this.emitter.removeAllListeners();
  }
}

// Export singleton instance
export const eventBus = EventBus.getInstance();