/**
 * Hook for integrating development task synchronization with the agent's task management
 * This monitors the agent's task list and syncs changes to Eric Parker/Tasks
 */

import { devTaskSyncService, DevTask } from './devTaskSync';
import * as fs from 'fs/promises';
import * as path from 'path';
import { watch } from 'fs';

export class AgentTaskHook {
  private static instance: AgentTaskHook;
  private tasksFile: string;
  private lastTasks: Map<string, DevTask> = new Map();
  private initialized: boolean = false;
  
  private constructor() {
    this.tasksFile = path.join(process.cwd(), '.agent', 'tasks.json');
    this.initialize();
  }
  
  static getInstance(): AgentTaskHook {
    if (!AgentTaskHook.instance) {
      AgentTaskHook.instance = new AgentTaskHook();
    }
    return AgentTaskHook.instance;
  }
  
  private async initialize() {
    try {
      console.log('[AgentTaskHook] Initializing agent task synchronization hook...');
      
      // Ensure .agent directory exists
      const agentDir = path.dirname(this.tasksFile);
      await fs.mkdir(agentDir, { recursive: true });
      
      // Load initial tasks if file exists
      await this.loadTasks();
      
      // Watch for changes
      this.watchTaskFile();
      
      this.initialized = true;
      console.log('[AgentTaskHook] Agent task hook initialized');
      
      // Initial sync
      await this.syncChanges();
    } catch (error) {
      console.error('[AgentTaskHook] Failed to initialize:', error);
    }
  }
  
  private async loadTasks(): Promise<void> {
    try {
      const data = await fs.readFile(this.tasksFile, 'utf-8');
      const tasksData = JSON.parse(data);
      const tasks = tasksData.tasks || [];
      
      this.lastTasks.clear();
      for (const task of tasks) {
        this.lastTasks.set(task.id, task);
      }
      
      console.log(`[AgentTaskHook] Loaded ${this.lastTasks.size} existing tasks`);
    } catch (error) {
      // File doesn't exist yet, that's okay
      console.log('[AgentTaskHook] No existing task file found');
    }
  }
  
  private async watchTaskFile() {
    // Create a simple polling mechanism since fs.watch can be unreliable
    setInterval(async () => {
      await this.checkForChanges();
    }, 5000); // Check every 5 seconds
  }
  
  private async checkForChanges() {
    try {
      const data = await fs.readFile(this.tasksFile, 'utf-8');
      const tasksData = JSON.parse(data);
      const currentTasks = tasksData.tasks || [];
      
      // Check for new or updated tasks
      for (const task of currentTasks) {
        const lastTask = this.lastTasks.get(task.id);
        
        if (!lastTask) {
          // New task created
          console.log(`[AgentTaskHook] New task detected: ${task.title}`);
          await devTaskSyncService.onTaskCreated(task);
        } else if (lastTask.status !== task.status) {
          // Task status changed
          console.log(`[AgentTaskHook] Task status changed: ${task.title} (${lastTask.status} -> ${task.status})`);
          
          if (task.status === 'completed') {
            await devTaskSyncService.onTaskCompleted(task.id);
          } else {
            await devTaskSyncService.onTaskStatusChanged(task.id, task.status);
          }
        }
      }
      
      // Update our cache
      this.lastTasks.clear();
      for (const task of currentTasks) {
        this.lastTasks.set(task.id, task);
      }
    } catch (error) {
      // File might not exist yet, ignore
    }
  }
  
  private async syncChanges() {
    if (!this.initialized) return;
    
    try {
      await devTaskSyncService.syncAllTasks();
    } catch (error) {
      console.error('[AgentTaskHook] Failed to sync changes:', error);
    }
  }
  
  /**
   * Manually trigger a sync of all tasks
   */
  async forceSyncAll(): Promise<void> {
    console.log('[AgentTaskHook] Force syncing all tasks...');
    await this.loadTasks();
    await devTaskSyncService.syncAllTasks();
  }
  
  /**
   * Handle write_task_list tool usage
   * This is called when the agent updates the task list
   */
  async onTaskListUpdated(tasks: DevTask[]): Promise<void> {
    console.log(`[AgentTaskHook] Task list updated with ${tasks.length} tasks`);
    
    // Save to file for persistence
    const tasksData = { tasks, lastUpdated: new Date().toISOString() };
    await fs.mkdir(path.dirname(this.tasksFile), { recursive: true });
    await fs.writeFile(this.tasksFile, JSON.stringify(tasksData, null, 2));
    
    // Sync with Dart
    await this.checkForChanges();
  }
}

// Export singleton instance
export const agentTaskHook = AgentTaskHook.getInstance();