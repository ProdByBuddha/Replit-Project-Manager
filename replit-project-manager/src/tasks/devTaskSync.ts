import { TaskService } from 'dart-tools';
import { OpenAPI } from 'dart-tools';
import * as path from 'path';
import * as fs from 'fs/promises';
import { RPMConfig } from '../types.js';

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
 * Development Task Synchronization Service
 * 
 * Synchronizes development/coding tasks with Eric Parker/Tasks dartboard
 * Ensures every development task is reflected in Dart AI for visibility
 */
export class DevTaskSyncService {
  private static instance: DevTaskSyncService;
  private dartToken: string;
  private dartboard: string;
  private mappingFile: string;
  private taskMappings: Map<string, DevTaskMapping> = new Map();
  private initialized: boolean = false;
  private tasksFile: string;
  
  private constructor(config: RPMConfig = {}) {
    this.dartToken = config.dartToken || process.env.DART_TOKEN || '';
    this.dartboard = config.dartboard || 'Eric Parker/Tasks';
    this.mappingFile = path.join(process.cwd(), '.dart-reports', 'dev-task-mappings.json');
    this.tasksFile = path.join(process.cwd(), '.agent', 'tasks.json');
    
    if (this.dartToken) {
      OpenAPI.TOKEN = this.dartToken;
      this.initialize();
    }
  }
  
  static getInstance(config?: RPMConfig): DevTaskSyncService {
    if (!DevTaskSyncService.instance) {
      DevTaskSyncService.instance = new DevTaskSyncService(config);
    }
    return DevTaskSyncService.instance;
  }
  
  public configure(config: RPMConfig): void {
    if (config.dartToken) {
      this.dartToken = config.dartToken;
      OpenAPI.TOKEN = this.dartToken;
    }
    if (config.dartboard) this.dartboard = config.dartboard;
  }
  
  private async initialize() {
    try {
      await this.loadMappings();
      console.log('[DevTaskSync] Development task synchronization service initialized');
      this.initialized = true;
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
  
  async readTasks(): Promise<DevTask[]> {
    try {
      const data = await fs.readFile(this.tasksFile, 'utf-8');
      const tasksData = JSON.parse(data);
      return tasksData.tasks || [];
    } catch (error) {
      return [];
    }
  }
  
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
  
  async syncTask(task: DevTask): Promise<boolean> {
    if (!this.initialized || !this.dartToken) {
      return false;
    }
    
    try {
      const existingMapping = this.taskMappings.get(task.id);
      
      if (existingMapping) {
        if (existingMapping.lastStatus !== task.status) {
          return await this.updateDartTask(existingMapping.dartTaskId, task);
        }
        return true;
      } else {
        return await this.createDartTask(task);
      }
    } catch (error) {
      console.error(`[DevTaskSync] Error syncing task ${task.id}:`, error);
      return false;
    }
  }
  
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
          dartboard: this.dartboard,
          tags: ['development', 'coding']
        }
      });
      
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
  
  private async updateDartTask(dartTaskId: string, task: DevTask): Promise<boolean> {
    try {
      let existingTask;
      try {
        existingTask = await TaskService.getTask({ id: dartTaskId });
      } catch (getError) {
        console.log(`[DevTaskSync] Dart task ${dartTaskId} not found, creating new one`);
        this.taskMappings.delete(task.id);
        return await this.createDartTask(task);
      }
      
      const dartStatus = this.mapStatusToDart(task.status);
      const title = `[Dev] ${task.title}`;
      const description = this.buildTaskDescription(task);
      
      await TaskService.updateTask({
        id: dartTaskId,
        requestBody: {
          title,
          description,
          status: dartStatus
        }
      });
      
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
  
  private mapStatusToDart(status: string): string {
    switch (status) {
      case 'pending':
        return 'To-do';
      case 'in_progress':
        return 'Doing';
      case 'completed_pending_review':
        return 'Doing';
      case 'completed':
        return 'Done';
      default:
        return 'To-do';
    }
  }
  
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
  
  async onTaskCreated(task: DevTask): Promise<void> {
    console.log(`[DevTaskSync] New development task created: ${task.title}`);
    await this.syncTask(task);
  }
  
  async onTaskStatusChanged(taskId: string, newStatus: string): Promise<void> {
    const tasks = await this.readTasks();
    const task = tasks.find(t => t.id === taskId);
    
    if (task) {
      console.log(`[DevTaskSync] Task status changed: ${task.title} -> ${newStatus}`);
      task.status = newStatus as any;
      await this.syncTask(task);
    }
  }
  
  async onTaskCompleted(taskId: string): Promise<void> {
    const tasks = await this.readTasks();
    const task = tasks.find(t => t.id === taskId);
    
    if (task) {
      console.log(`[DevTaskSync] Task completed: ${task.title}`);
      task.status = 'completed';
      await this.syncTask(task);
    }
  }
  
  async onTaskListUpdated(tasks: DevTask[]): Promise<void> {
    console.log(`[DevTaskSync] Task list updated with ${tasks.length} tasks`);
    
    const tasksData = { tasks, lastUpdated: new Date().toISOString() };
    await fs.mkdir(path.dirname(this.tasksFile), { recursive: true });
    await fs.writeFile(this.tasksFile, JSON.stringify(tasksData, null, 2));
    
    await this.syncAllTasks();
  }
}