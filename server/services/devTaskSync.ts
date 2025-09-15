import { TaskService } from 'dart-tools';
import { OpenAPI } from 'dart-tools';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface DevTask {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed_pending_review' | 'completed';
  createdAt: string;
  updatedAt: string;
  dartTaskId?: string;
  architect_reviewed?: 'yes' | 'no' | 'not_applicable';
  architect_reviewed_reason?: string;
}

interface DevTaskMapping {
  taskId: string;
  dartTaskId: string;
  lastStatus: string;
  lastUpdated: string;
}

/**
 * Service for synchronizing development tasks with Eric Parker/Tasks dartboard
 * Ensures every development task (coding/feature work) is reflected in Dart
 */
export class DevTaskSyncService {
  private static instance: DevTaskSyncService;
  private dartToken: string;
  private mappingFile: string;
  private taskMappings: Map<string, DevTaskMapping> = new Map();
  private initialized: boolean = false;
  private readonly DARTBOARD = 'Eric Parker/Tasks';
  private tasksFile: string;
  
  private constructor() {
    this.dartToken = process.env.DART_TOKEN || '';
    this.mappingFile = path.join(process.cwd(), '.dart-reports', 'dev-task-mappings.json');
    this.tasksFile = path.join(process.cwd(), '.agent', 'tasks.json');
    
    if (this.dartToken) {
      OpenAPI.TOKEN = this.dartToken;
      this.initialize();
    }
  }
  
  static getInstance(): DevTaskSyncService {
    if (!DevTaskSyncService.instance) {
      DevTaskSyncService.instance = new DevTaskSyncService();
    }
    return DevTaskSyncService.instance;
  }
  
  private async initialize() {
    try {
      // Load existing task mappings
      await this.loadMappings();
      
      // Watch for task file changes
      this.watchTaskFile();
      
      console.log('[DevTaskSync] Development task synchronization service initialized');
      this.initialized = true;
      
      // Initial sync of any existing tasks
      await this.syncAllTasks();
    } catch (error) {
      console.error('[DevTaskSync] Failed to initialize:', error);
    }
  }
  
  private async loadMappings() {
    try {
      const data = await fs.readFile(this.mappingFile, 'utf-8');
      const mappings = JSON.parse(data) as DevTaskMapping[];
      this.taskMappings = new Map(mappings.map(m => [m.taskId, m]));
      console.log(`[DevTaskSync] Loaded ${this.taskMappings.size} dev task mappings`);
    } catch (error) {
      console.log('[DevTaskSync] No existing dev task mappings found, starting fresh');
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
      console.error('[DevTaskSync] Failed to save mappings:', error);
    }
  }
  
  private async watchTaskFile() {
    // Watch for changes to the task file
    try {
      const watcher = fs.watch(this.tasksFile);
      
      for await (const event of watcher) {
        if (event.eventType === 'change') {
          console.log('[DevTaskSync] Task file changed, syncing...');
          await this.syncAllTasks();
        }
      }
    } catch (error) {
      console.log('[DevTaskSync] Task file not found yet, will sync when created');
    }
  }
  
  /**
   * Read tasks from the agent's task file
   */
  private async readTasks(): Promise<DevTask[]> {
    try {
      const data = await fs.readFile(this.tasksFile, 'utf-8');
      const tasksData = JSON.parse(data);
      return tasksData.tasks || [];
    } catch (error) {
      return [];
    }
  }
  
  /**
   * Sync all development tasks with Dart
   */
  async syncAllTasks(): Promise<void> {
    if (!this.initialized || !this.dartToken) {
      return;
    }
    
    try {
      const tasks = await this.readTasks();
      console.log(`[DevTaskSync] Found ${tasks.length} development tasks to sync`);
      
      for (const task of tasks) {
        await this.syncTask(task);
      }
    } catch (error) {
      console.error('[DevTaskSync] Failed to sync all tasks:', error);
    }
  }
  
  /**
   * Sync a single development task with Dart
   */
  async syncTask(task: DevTask): Promise<boolean> {
    if (!this.initialized || !this.dartToken) {
      return false;
    }
    
    try {
      const existingMapping = this.taskMappings.get(task.id);
      
      if (existingMapping) {
        // Update existing task if status changed
        if (existingMapping.lastStatus !== task.status) {
          return await this.updateDartTask(existingMapping.dartTaskId, task);
        }
        return true; // No update needed
      } else {
        // Create new task
        return await this.createDartTask(task);
      }
    } catch (error) {
      console.error(`[DevTaskSync] Error syncing task ${task.id}:`, error);
      return false;
    }
  }
  
  /**
   * Create a new development task in Dart
   */
  private async createDartTask(task: DevTask): Promise<boolean> {
    try {
      const dartStatus = this.mapStatusToDart(task.status);
      const title = `[Dev] ${task.title}`;
      const description = this.buildTaskDescription(task);
      
      const result = await TaskService.createTask({
        item: {
          title,
          description,
          status: dartStatus,
          dartboard: this.DARTBOARD,
          tags: ['development', 'coding']
        }
      });
      
      // Store the mapping
      const mapping: DevTaskMapping = {
        taskId: task.id,
        dartTaskId: result.item.id,
        lastStatus: task.status,
        lastUpdated: new Date().toISOString()
      };
      
      this.taskMappings.set(task.id, mapping);
      await this.saveMappings();
      
      console.log(`[DevTaskSync] Created Dart task ${result.item.id} for dev task: ${task.title}`);
      return true;
    } catch (error: any) {
      console.error(`[DevTaskSync] Failed to create Dart task:`, error.body || error.message);
      return false;
    }
  }
  
  /**
   * Update an existing development task in Dart
   */
  private async updateDartTask(dartTaskId: string, task: DevTask): Promise<boolean> {
    try {
      // First try to get the existing task
      let existingTask;
      try {
        existingTask = await TaskService.getTask({ id: dartTaskId });
      } catch (getError) {
        console.log(`[DevTaskSync] Dart task ${dartTaskId} not found, creating new one`);
        // Task doesn't exist in Dart, remove mapping and create new
        this.taskMappings.delete(task.id);
        return await this.createDartTask(task);
      }
      
      const dartStatus = this.mapStatusToDart(task.status);
      const title = `[Dev] ${task.title}`;
      const description = this.buildTaskDescription(task);
      
      // Update the task
      await TaskService.updateTask({
        id: dartTaskId,
        requestBody: {
          title,
          description,
          status: dartStatus
        }
      });
      
      // Update the mapping
      const mapping = this.taskMappings.get(task.id);
      if (mapping) {
        mapping.lastStatus = task.status;
        mapping.lastUpdated = new Date().toISOString();
        await this.saveMappings();
      }
      
      console.log(`[DevTaskSync] Updated Dart task for: ${task.title} (${task.status})`);
      return true;
    } catch (error: any) {
      console.error(`[DevTaskSync] Failed to update Dart task:`, error.body || error.message);
      return false;
    }
  }
  
  /**
   * Map internal development task status to Dart status
   */
  private mapStatusToDart(status: string): string {
    switch (status) {
      case 'pending':
        return 'To-do';
      case 'in_progress':
        return 'Doing';
      case 'completed_pending_review':
        return 'Doing'; // Still in progress until reviewed
      case 'completed':
        return 'Done';
      default:
        return 'To-do';
    }
  }
  
  /**
   * Build task description with development context
   */
  private buildTaskDescription(task: DevTask): string {
    let description = task.description || 'Development task';
    
    description += `\n\n**Status:** ${task.status}`;
    description += `\n**Created:** ${new Date(task.createdAt).toLocaleDateString()}`;
    
    if (task.updatedAt) {
      description += `\n**Last Updated:** ${new Date(task.updatedAt).toLocaleDateString()}`;
    }
    
    if (task.architect_reviewed) {
      description += `\n\n**Architect Review:** ${task.architect_reviewed}`;
      if (task.architect_reviewed_reason) {
        description += `\n**Review Notes:** ${task.architect_reviewed_reason}`;
      }
    }
    
    return description;
  }
  
  /**
   * Handle task creation event
   */
  async onTaskCreated(task: DevTask): Promise<void> {
    console.log(`[DevTaskSync] New development task created: ${task.title}`);
    await this.syncTask(task);
  }
  
  /**
   * Handle task status change event
   */
  async onTaskStatusChanged(taskId: string, newStatus: string): Promise<void> {
    const tasks = await this.readTasks();
    const task = tasks.find(t => t.id === taskId);
    
    if (task) {
      console.log(`[DevTaskSync] Task status changed: ${task.title} -> ${newStatus}`);
      task.status = newStatus as any;
      await this.syncTask(task);
    }
  }
  
  /**
   * Handle task completion event
   */
  async onTaskCompleted(taskId: string): Promise<void> {
    const tasks = await this.readTasks();
    const task = tasks.find(t => t.id === taskId);
    
    if (task) {
      console.log(`[DevTaskSync] Task completed: ${task.title}`);
      task.status = 'completed';
      await this.syncTask(task);
    }
  }
}

// Export singleton instance
export const devTaskSyncService = DevTaskSyncService.getInstance();