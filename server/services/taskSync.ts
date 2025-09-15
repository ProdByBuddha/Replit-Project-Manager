import { TaskService } from 'dart-tools';
import { OpenAPI } from 'dart-tools';
import { eventBus } from '../automation/EventBus';
import { storage } from '../storage';
import { FamilyTask, Task } from '@shared/schema';

type TaskStatus = 'not_started' | 'in_progress' | 'completed';
import * as path from 'path';
import * as fs from 'fs/promises';

interface DartTaskMapping {
  familyTaskId: string;
  dartTaskId: string;
  lastStatus: TaskStatus;
  lastUpdated: string;
}

/**
 * Service for synchronizing tasks with Eric Parker/Tasks dartboard
 * Ensures every task created/updated in the system is reflected in Dart
 */
export class TaskSyncService {
  private static instance: TaskSyncService;
  private dartToken: string;
  private mappingFile: string;
  private taskMappings: Map<string, DartTaskMapping> = new Map();
  private initialized: boolean = false;
  private readonly DARTBOARD = 'Eric Parker/Tasks';
  
  private constructor() {
    this.dartToken = process.env.DART_TOKEN || '';
    this.mappingFile = path.join(process.cwd(), '.dart-reports', 'task-mappings.json');
    
    if (this.dartToken) {
      OpenAPI.TOKEN = this.dartToken;
      this.initialize();
    }
  }
  
  static getInstance(): TaskSyncService {
    if (!TaskSyncService.instance) {
      TaskSyncService.instance = new TaskSyncService();
    }
    return TaskSyncService.instance;
  }
  
  private async initialize() {
    try {
      // Load existing task mappings
      await this.loadMappings();
      
      // Subscribe to task events
      this.subscribeToEvents();
      
      console.log('[TaskSync] Task synchronization service initialized');
      this.initialized = true;
    } catch (error) {
      console.error('[TaskSync] Failed to initialize:', error);
    }
  }
  
  private async loadMappings() {
    try {
      const data = await fs.readFile(this.mappingFile, 'utf-8');
      const mappings = JSON.parse(data) as DartTaskMapping[];
      this.taskMappings = new Map(mappings.map(m => [m.familyTaskId, m]));
      console.log(`[TaskSync] Loaded ${this.taskMappings.size} task mappings`);
    } catch (error) {
      // File doesn't exist or is corrupted, start fresh
      console.log('[TaskSync] No existing task mappings found, starting fresh');
      this.taskMappings = new Map();
    }
  }
  
  private async saveMappings() {
    try {
      const mappings = Array.from(this.taskMappings.values());
      const dir = path.dirname(this.mappingFile);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.mappingFile, JSON.stringify(mappings, null, 2));
    } catch (error) {
      console.error('[TaskSync] Failed to save mappings:', error);
    }
  }
  
  private subscribeToEvents() {
    // Subscribe to task status changes
    eventBus.onTaskStatusChanged(async (event) => {
      await this.syncTaskStatus(event.familyTaskId, event.newStatus);
    });
    
    // Subscribe to task completions
    eventBus.onTaskCompleted(async (event) => {
      await this.syncTaskStatus(event.familyTaskId, 'completed');
    });
    
    console.log('[TaskSync] Subscribed to task events');
  }
  
  /**
   * Sync a family task with Dart AI
   */
  async syncTask(familyTaskId: string): Promise<boolean> {
    if (!this.initialized || !this.dartToken) {
      console.log('[TaskSync] Service not initialized or no token');
      return false;
    }
    
    try {
      // Get the family task details
      const familyTask = await storage.getFamilyTask(familyTaskId);
      if (!familyTask) {
        console.error(`[TaskSync] Family task ${familyTaskId} not found`);
        return false;
      }
      
      // Get the actual task template details
      const tasks = await storage.getAllTasks();
      const task = tasks.find(t => t.id === familyTask.taskId);
      if (!task) {
        console.error(`[TaskSync] Task template ${familyTask.taskId} not found`);
        return false;
      }
      
      // Get family details for context
      const family = await storage.getFamily(familyTask.familyId);
      const familyName = family?.name || 'Unknown Family';
      
      // Check if we already have a Dart task for this
      const existingMapping = this.taskMappings.get(familyTaskId);
      
      if (existingMapping) {
        // Update existing task
        return await this.updateDartTask(existingMapping.dartTaskId, familyTask, task, familyName);
      } else {
        // Create new task
        return await this.createDartTask(familyTaskId, familyTask, task, familyName);
      }
    } catch (error) {
      console.error(`[TaskSync] Error syncing task ${familyTaskId}:`, error);
      return false;
    }
  }
  
  /**
   * Sync task status change with Dart
   */
  async syncTaskStatus(familyTaskId: string, newStatus: TaskStatus): Promise<boolean> {
    console.log(`[TaskSync] Syncing status change for ${familyTaskId} to ${newStatus}`);
    return await this.syncTask(familyTaskId);
  }
  
  /**
   * Create a new task in Dart
   */
  private async createDartTask(
    familyTaskId: string, 
    familyTask: FamilyTask, 
    task: Task,
    familyName: string
  ): Promise<boolean> {
    try {
      const dartStatus = this.mapStatusToDart(familyTask.status);
      const title = `${familyName}: ${task.title}`;
      const description = this.buildTaskDescription(familyTask, task);
      
      const result = await TaskService.createTask({
        item: {
          title,
          description,
          status: dartStatus,
          dartboard: this.DARTBOARD,
          dueAt: undefined,
          tags: task.category ? [task.category] : []
        }
      });
      
      // Store the mapping
      const mapping: DartTaskMapping = {
        familyTaskId,
        dartTaskId: result.item.id,
        lastStatus: familyTask.status,
        lastUpdated: new Date().toISOString()
      };
      
      this.taskMappings.set(familyTaskId, mapping);
      await this.saveMappings();
      
      console.log(`[TaskSync] Created Dart task ${result.item.id} for family task ${familyTaskId}`);
      return true;
    } catch (error) {
      console.error(`[TaskSync] Failed to create Dart task:`, error);
      return false;
    }
  }
  
  /**
   * Update an existing task in Dart
   */
  private async updateDartTask(
    dartTaskId: string,
    familyTask: FamilyTask,
    task: Task,
    familyName: string
  ): Promise<boolean> {
    try {
      // First try to get the existing task
      let existingTask;
      try {
        existingTask = await TaskService.getTask({ id: dartTaskId });
      } catch (getError) {
        console.log(`[TaskSync] Dart task ${dartTaskId} not found, creating new one`);
        // Task doesn't exist in Dart, remove mapping and create new
        this.taskMappings.delete(familyTask.id);
        return await this.createDartTask(familyTask.id, familyTask, task, familyName);
      }
      
      const dartStatus = this.mapStatusToDart(familyTask.status);
      const title = `${familyName}: ${task.title}`;
      const description = this.buildTaskDescription(familyTask, task);
      
      // Update the task
      await TaskService.updateTask({
        id: dartTaskId,
        requestBody: {
          title,
          description,
          status: dartStatus,
          dueAt: undefined
        }
      });
      
      // Update the mapping
      const mapping = this.taskMappings.get(familyTask.id);
      if (mapping) {
        mapping.lastStatus = familyTask.status;
        mapping.lastUpdated = new Date().toISOString();
        await this.saveMappings();
      }
      
      console.log(`[TaskSync] Updated Dart task ${dartTaskId} for family task ${familyTask.id}`);
      return true;
    } catch (error) {
      console.error(`[TaskSync] Failed to update Dart task:`, error);
      return false;
    }
  }
  
  /**
   * Map internal status to Dart status
   */
  private mapStatusToDart(status: TaskStatus): string {
    switch (status) {
      case 'not_started':
        return 'To-do';
      case 'in_progress':
        return 'Doing';
      case 'completed':
        return 'Done';
      default:
        return 'To-do';
    }
  }
  
  /**
   * Build task description with context
   */
  private buildTaskDescription(familyTask: FamilyTask, task: Task): string {
    let description = task.description || 'No description';
    
    if (familyTask.notes) {
      description += `\n\n**Notes:**\n${familyTask.notes}`;
    }
    
    if (familyTask.completedAt) {
      description += `\n\n**Completed:** ${new Date(familyTask.completedAt).toLocaleDateString()}`;
    }
    
    return description;
  }
  
  /**
   * Sync all tasks for a family
   */
  async syncFamilyTasks(familyId: string): Promise<void> {
    try {
      const familyTasks = await storage.getFamilyTasks(familyId);
      console.log(`[TaskSync] Syncing ${familyTasks.length} tasks for family ${familyId}`);
      
      for (const familyTask of familyTasks) {
        await this.syncTask(familyTask.id);
      }
      
      console.log(`[TaskSync] Completed syncing tasks for family ${familyId}`);
    } catch (error) {
      console.error(`[TaskSync] Failed to sync family tasks:`, error);
    }
  }
  
  /**
   * Get sync status for a task
   */
  getSyncStatus(familyTaskId: string): { synced: boolean; dartTaskId?: string; lastUpdated?: string } {
    const mapping = this.taskMappings.get(familyTaskId);
    if (mapping) {
      return {
        synced: true,
        dartTaskId: mapping.dartTaskId,
        lastUpdated: mapping.lastUpdated
      };
    }
    return { synced: false };
  }
  
  /**
   * Force resync all tasks
   */
  async resyncAll(): Promise<void> {
    try {
      console.log('[TaskSync] Starting full resync of all tasks...');
      const families = await storage.getAllFamilies();
      
      for (const family of families) {
        await this.syncFamilyTasks(family.id);
      }
      
      console.log('[TaskSync] Full resync completed');
    } catch (error) {
      console.error('[TaskSync] Failed to resync all tasks:', error);
    }
  }
}

// Export singleton instance
export const taskSyncService = TaskSyncService.getInstance();