import axios, { AxiosInstance, AxiosError } from "axios";
import { db } from "../db";
import { dartProjects, dartTasks, dartSyncLogs } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { storage } from "../storage";
import { eventBus } from "../automation/EventBus";

// Dart API Types
interface DartTask {
  dartId: string;
  projectDartId: string;
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  status: 'todo' | 'in_progress' | 'completed' | 'blocked';
  assignee?: string;
  progress?: number;
  metadata?: Record<string, any>;
}

interface DartProject {
  dartId: string;
  workspaceDartId?: string;
  name: string;
  description?: string;
  status: 'active' | 'completed' | 'archived';
  metadata?: Record<string, any>;
}

interface DartProgressReport {
  projectName: string;
  timestamp: Date;
  stats: {
    total: number;
    completed: number;
    inProgress: number;
    todo: number;
    blocked: number;
  };
  progressPercentage: number;
  recentCompletions: string[];
  lastUpdated: Date;
}

// Debounce configuration
interface DebouncedReport {
  familyId: string;
  projectId: string;
  timer?: NodeJS.Timeout;
  lastTriggered: Date;
  pendingTaskIds: Set<string>;
}

export class DartAIService {
  private apiKey: string;
  private baseUrl = 'https://app.itsdart.com/api/v0';
  private axiosInstance: AxiosInstance;
  private debouncedReports: Map<string, DebouncedReport> = new Map();
  private debounceWindow = 60000; // 60 seconds
  private static instance: DartAIService;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.DART_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('[DartAI] API key not configured. Service will be disabled.');
    }

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      response => response,
      async error => {
        await this.logSyncError('api_request', error);
        throw error;
      }
    );

    // Register event listeners for automatic reporting
    this.registerEventListeners();
  }

  // Singleton pattern for event registration
  public static getInstance(apiKey?: string): DartAIService {
    if (!DartAIService.instance) {
      DartAIService.instance = new DartAIService(apiKey);
    }
    return DartAIService.instance;
  }

  // Check if service is configured
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  // Register event listeners for automatic task reporting
  private registerEventListeners(): void {
    if (!this.isConfigured()) {
      console.log('[DartAI] Service not configured, skipping event registration');
      return;
    }

    console.log('[DartAI] Registering event listeners for automatic reporting');

    // Listen for task completion events
    eventBus.onTaskCompleted(async (event) => {
      try {
        console.log(`[DartAI] Task completed event received for family ${event.familyId}`);
        
        // Update the individual task in Dart
        await this.syncFamilyTask(event.familyTaskId);
        
        // Queue debounced progress report
        await this.queueProgressReport(event.familyId);
      } catch (error) {
        console.error('[DartAI] Error handling task completion:', error);
      }
    });

    // Listen for task status changes
    eventBus.onTaskStatusChanged(async (event) => {
      try {
        // Only sync on meaningful status changes
        if (['completed', 'in_progress', 'blocked'].includes(event.newStatus)) {
          console.log(`[DartAI] Task status changed to ${event.newStatus} for family ${event.familyId}`);
          
          // Update the individual task in Dart
          await this.syncFamilyTask(event.familyTaskId);
          
          // Queue debounced progress report
          await this.queueProgressReport(event.familyId);
        }
      } catch (error) {
        console.error('[DartAI] Error handling task status change:', error);
      }
    });
  }

  // Queue a debounced progress report
  private async queueProgressReport(familyId: string): Promise<void> {
    try {
      // Get or create Dart project for family
      const project = await this.ensureFamilyProject(familyId);
      if (!project) {
        console.warn(`[DartAI] Could not get/create project for family ${familyId}`);
        return;
      }

      const key = `${familyId}-${project.dartId}`;
      
      // Get existing debounced report or create new one
      let debouncedReport = this.debouncedReports.get(key);
      
      if (debouncedReport) {
        // Clear existing timer
        if (debouncedReport.timer) {
          clearTimeout(debouncedReport.timer);
        }
      } else {
        // Create new debounced report
        debouncedReport = {
          familyId,
          projectId: project.dartId,
          lastTriggered: new Date(),
          pendingTaskIds: new Set(),
        };
        this.debouncedReports.set(key, debouncedReport);
      }

      // Update last triggered time
      debouncedReport.lastTriggered = new Date();

      // Set new timer for debounced execution
      debouncedReport.timer = setTimeout(async () => {
        console.log(`[DartAI] Sending debounced progress report for family ${familyId}`);
        
        try {
          // Calculate and send progress report
          const report = await this.calculateFamilyProgress(familyId);
          await this.sendProjectProgressReport(project.dartId, report);
          
          // Clear the debounced report
          this.debouncedReports.delete(key);
        } catch (error) {
          console.error('[DartAI] Error sending debounced progress report:', error);
        }
      }, this.debounceWindow);

    } catch (error) {
      console.error('[DartAI] Error queueing progress report:', error);
    }
  }

  // Calculate family progress for reporting
  private async calculateFamilyProgress(familyId: string): Promise<DartProgressReport> {
    const family = await storage.getFamily(familyId);
    const familyTasks = await storage.getFamilyTasks(familyId);
    
    const stats = {
      total: familyTasks.length,
      completed: 0,
      inProgress: 0,
      todo: 0,
      blocked: 0,
    };
    
    const recentCompletions: string[] = [];
    
    // Sort by completed date to get recent completions
    const completedTasks = familyTasks
      .filter(ft => ft.status === 'completed' && ft.completedAt)
      .sort((a, b) => {
        const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 5);
    
    completedTasks.forEach(ft => {
      recentCompletions.push(ft.task.title);
    });
    
    // Count task statuses
    familyTasks.forEach(ft => {
      switch (ft.status) {
        case 'completed':
          stats.completed++;
          break;
        case 'in_progress':
          stats.inProgress++;
          break;
        case 'blocked':
          stats.blocked++;
          break;
        default:
          stats.todo++;
      }
    });
    
    const progressPercentage = stats.total > 0 
      ? Math.round((stats.completed / stats.total) * 100)
      : 0;
    
    return {
      projectName: family ? `${family.name} - Status Correction` : 'Status Correction',
      timestamp: new Date(),
      stats,
      progressPercentage,
      recentCompletions,
      lastUpdated: new Date(),
    };
  }

  // Ensure a Dart project exists for a family
  async ensureFamilyProject(familyId: string, projectName?: string): Promise<DartProject | null> {
    if (!this.isConfigured()) return null;

    try {
      // Check if project already exists
      const [existingProject] = await db
        .select()
        .from(dartProjects)
        .where(eq(dartProjects.familyId, familyId))
        .limit(1);

      if (existingProject) {
        return {
          dartId: existingProject.dartProjectId,
          name: existingProject.name,
          status: existingProject.status as 'active' | 'completed' | 'archived',
          metadata: existingProject.metadata as Record<string, any>,
        };
      }

      // Create new project
      const family = await storage.getFamily(familyId);
      const name = projectName || (family ? `${family.name} - Status Correction` : 'Status Correction');
      
      const response = await this.axiosInstance.post('/projects', {
        name,
        description: `Status correction tracking for family ${familyId}`,
        status: 'active',
      });

      const dartProject: DartProject = response.data;

      // Store project mapping
      await db.insert(dartProjects).values({
        familyId,
        dartProjectId: dartProject.dartId,
        name,
        status: 'active',
        metadata: {},
      });

      await this.logSync('project', dartProject.dartId, 'create', 'success', familyId);

      return dartProject;
    } catch (error) {
      await this.logSync('project', familyId, 'create', 'failed', familyId, null, null,
        error instanceof Error ? error.message : 'Unknown error', error);
      return null;
    }
  }

  // Sync a single family task to Dart
  async syncFamilyTask(familyTaskId: string): Promise<boolean> {
    if (!this.isConfigured()) return false;

    try {
      // Get family task with details
      const familyTask = await storage.getFamilyTaskWithTask(familyTaskId);
      if (!familyTask) {
        console.warn(`[DartAI] Family task not found: ${familyTaskId}`);
        return false;
      }

      // Ensure project exists
      const project = await this.ensureFamilyProject(familyTask.familyId);
      if (!project) {
        console.warn(`[DartAI] Could not get/create project for family ${familyTask.familyId}`);
        return false;
      }

      // Map status
      const dartStatus = this.mapStatusToDart(familyTask.status);
      
      // Create or update task in Dart
      await this.createOrUpdateTask(familyTaskId, {
        title: familyTask.task.title,
        description: familyTask.task.description || familyTask.notes || undefined,
        status: dartStatus,
        projectDartId: project.dartId,
        progress: familyTask.status === 'completed' ? 100 : 
                 familyTask.status === 'in_progress' ? 50 : 0,
      });

      return true;
    } catch (error) {
      console.error(`[DartAI] Error syncing family task ${familyTaskId}:`, error);
      return false;
    }
  }

  // Sync all tasks for a family
  async syncFamily(familyId: string): Promise<{
    success: boolean;
    tasksSynced?: number;
    tasksFailed?: number;
    errors?: string[];
  }> {
    if (!this.isConfigured()) {
      return { success: false, errors: ['Dart AI service not configured'] };
    }

    try {
      // Ensure project exists
      const project = await this.ensureFamilyProject(familyId);
      if (!project) {
        return { success: false, errors: ['Failed to create/get Dart project'] };
      }

      // Get all family tasks
      const familyTasks = await storage.getFamilyTasks(familyId);
      
      let tasksSynced = 0;
      let tasksFailed = 0;
      const errors: string[] = [];

      for (const familyTask of familyTasks) {
        try {
          const dartStatus = this.mapStatusToDart(familyTask.status);
          
          await this.createOrUpdateTask(familyTask.id, {
            title: familyTask.task.title,
            description: familyTask.task.description || familyTask.notes || undefined,
            status: dartStatus,
            projectDartId: project.dartId,
            progress: familyTask.status === 'completed' ? 100 : 
                     familyTask.status === 'in_progress' ? 50 : 0,
          });
          
          tasksSynced++;
        } catch (error) {
          tasksFailed++;
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Task ${familyTask.task.title}: ${errorMsg}`);
        }
      }

      // Send progress report after sync
      const report = await this.calculateFamilyProgress(familyId);
      await this.sendProjectProgressReport(project.dartId, report);

      return {
        success: tasksFailed === 0,
        tasksSynced,
        tasksFailed,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  // Send project progress report to Dart
  async sendProjectProgressReport(projectDartId: string, report: DartProgressReport): Promise<boolean> {
    if (!this.isConfigured()) return false;

    try {
      // Create a comprehensive update message
      const updateMessage = `
📊 Progress Update: ${report.progressPercentage}% Complete

📈 Task Statistics:
• Total: ${report.stats.total}
• Completed: ${report.stats.completed}
• In Progress: ${report.stats.inProgress}
• Todo: ${report.stats.todo}
• Blocked: ${report.stats.blocked}

${report.recentCompletions.length > 0 ? `✅ Recent Completions:\n${report.recentCompletions.map(t => `• ${t}`).join('\n')}` : ''}

Last Updated: ${report.lastUpdated.toLocaleString()}
      `.trim();

      // Send update to Dart project
      await this.axiosInstance.post(`/projects/${projectDartId}/updates`, {
        message: updateMessage,
        metadata: report,
      });

      await this.logSync('project', projectDartId, 'update', 'success', undefined, report);
      
      console.log(`[DartAI] Progress report sent for project ${projectDartId}`);
      return true;
    } catch (error) {
      await this.logSync('project', projectDartId, 'update', 'failed', undefined, report, null,
        error instanceof Error ? error.message : 'Unknown error', error);
      console.error('[DartAI] Error sending progress report:', error);
      return false;
    }
  }

  // Create or update a task in Dart (simplified)
  private async createOrUpdateTask(
    familyTaskId: string,
    data: {
      title: string;
      description?: string;
      status?: 'todo' | 'in_progress' | 'completed' | 'blocked';
      projectDartId: string;
      progress?: number;
    }
  ): Promise<DartTask | null> {
    if (!this.isConfigured()) return null;

    try {
      // Check if task already exists
      const [existingTask] = await db
        .select()
        .from(dartTasks)
        .where(eq(dartTasks.familyTaskId, familyTaskId))
        .limit(1);

      let dartTask: DartTask;
      let operation: 'create' | 'update';

      if (existingTask) {
        // Update existing task (idempotent - check if update needed)
        if (existingTask.status === data.status && 
            existingTask.title === data.title &&
            existingTask.progress === data.progress) {
          // No update needed
          return {
            dartId: existingTask.dartTaskId,
            projectDartId: existingTask.dartProjectId,
            title: existingTask.title,
            status: existingTask.status as any,
            progress: existingTask.progress || 0,
          };
        }

        operation = 'update';
        const response = await this.axiosInstance.put(
          `/tasks/${existingTask.dartTaskId}`,
          {
            title: data.title,
            description: data.description,
            status: data.status || 'todo',
            progress: data.progress || 0,
          }
        );
        dartTask = response.data;
        
        // Update local tracking
        await db
          .update(dartTasks)
          .set({
            title: data.title,
            description: data.description,
            status: data.status || 'todo',
            progress: data.progress || 0,
            syncStatus: 'synced',
            lastSyncAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(dartTasks.id, existingTask.id));
      } else {
        // Create new task
        operation = 'create';
        const response = await this.axiosInstance.post('/tasks', {
          projectDartId: data.projectDartId,
          title: data.title,
          description: data.description,
          status: data.status || 'todo',
          progress: data.progress || 0,
        });
        dartTask = response.data;

        // Store task mapping
        await db.insert(dartTasks).values({
          familyTaskId,
          dartTaskId: dartTask.dartId,
          dartProjectId: data.projectDartId,
          title: data.title,
          description: data.description,
          status: data.status || 'todo',
          progress: data.progress || 0,
          syncStatus: 'synced',
          lastSyncAt: new Date(),
        });
      }

      await this.logSync('task', dartTask.dartId, operation, 'success');
      return dartTask;
    } catch (error) {
      await this.logSync('task', familyTaskId, 'sync', 'failed', undefined, data, null,
        error instanceof Error ? error.message : 'Unknown error', error);
      throw error;
    }
  }

  // Map internal status to Dart status
  private mapStatusToDart(status: string): 'todo' | 'in_progress' | 'completed' | 'blocked' {
    switch (status) {
      case 'completed':
        return 'completed';
      case 'in_progress':
        return 'in_progress';
      case 'blocked':
        return 'blocked';
      case 'pending':
      case 'not_started':
      default:
        return 'todo';
    }
  }

  // Log sync operations
  private async logSync(
    entityType: 'project' | 'task' | 'workspace',
    entityId: string,
    operation: 'create' | 'update' | 'delete' | 'sync',
    status: 'success' | 'failed' | 'partial',
    familyId?: string,
    requestData?: any,
    responseData?: any,
    errorMessage?: string,
    errorDetails?: any
  ) {
    try {
      await db.insert(dartSyncLogs).values({
        entityType,
        entityId,
        operation,
        status,
        familyId,
        requestData,
        responseData,
        errorMessage,
        errorDetails,
      });
    } catch (error) {
      console.error('Failed to log Dart sync operation:', error);
    }
  }

  // Log sync errors
  private async logSyncError(operation: string, error: any) {
    let errorMessage = 'Unknown error';
    let errorDetails = {};

    if (error instanceof AxiosError) {
      errorMessage = error.message;
      errorDetails = {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
        },
      };
    } else if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = { stack: error.stack };
    }

    console.error(`Dart AI ${operation} error:`, errorMessage, errorDetails);
  }

  // Create or update a task in Dart
  async createOrUpdateTask(
    familyTaskId: string,
    data: {
      title: string;
      description?: string;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      status?: 'todo' | 'in_progress' | 'completed' | 'blocked';
      assignee?: string;
      progress?: number;
      projectDartId: string;
    }
  ): Promise<DartTask | null> {
    if (!this.isConfigured()) {
      console.warn('Dart AI service not configured');
      return null;
    }

    try {
      // Check if task already exists in Dart
      const existingTask = await db
        .select()
        .from(dartTasks)
        .where(eq(dartTasks.familyTaskId, familyTaskId))
        .limit(1);

      let dartTask: DartTask;
      let operation: 'create' | 'update';

      if (existingTask.length > 0) {
        // Update existing task
        operation = 'update';
        const response = await this.axiosInstance.put(
          `/tasks/${existingTask[0].dartTaskId}`,
          {
            title: data.title,
            description: data.description,
            priority: data.priority,
            status: data.status || 'todo',
            assignee: data.assignee,
            progress: data.progress || 0,
          }
        );
        dartTask = response.data;
        
        // Update local tracking
        await db
          .update(dartTasks)
          .set({
            title: data.title,
            description: data.description,
            priority: data.priority,
            status: data.status || 'todo',
            assignee: data.assignee,
            progress: data.progress || 0,
            syncStatus: 'synced',
            lastSyncAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(dartTasks.id, existingTask[0].id));
      } else {
        // Create new task
        operation = 'create';
        const response = await this.axiosInstance.post('/tasks', {
          projectDartId: data.projectDartId,
          title: data.title,
          description: data.description,
          priority: data.priority || 'medium',
          status: data.status || 'todo',
          assignee: data.assignee,
          progress: data.progress || 0,
        });
        dartTask = response.data;

        // Store task mapping
        await db.insert(dartTasks).values({
          familyTaskId,
          dartTaskId: dartTask.dartId,
          dartProjectId: data.projectDartId,
          title: data.title,
          description: data.description,
          priority: data.priority || 'medium',
          status: data.status || 'todo',
          assignee: data.assignee,
          progress: data.progress || 0,
          syncStatus: 'synced',
          lastSyncAt: new Date(),
        });
      }

      // Log successful sync
      await this.logSync(
        'task',
        dartTask.dartId,
        operation,
        'success',
        undefined,
        data,
        dartTask
      );

      return dartTask;
    } catch (error) {
      await this.logSync(
        'task',
        familyTaskId,
        'create',
        'failed',
        undefined,
        data,
        null,
        error instanceof Error ? error.message : 'Unknown error',
        error
      );
      throw error;
    }
  }

  // Log sync errors
  private async logSyncError(operation: string, error: any) {
    let errorMessage = 'Unknown error';
    let errorDetails = {};

    if (error instanceof AxiosError) {
      errorMessage = error.message;
      errorDetails = {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
        },
      };
    } else if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = { stack: error.stack };
    }

    console.error(`[DartAI] ${operation} error:`, errorMessage, errorDetails);
  }

}

// Export singleton instance for automatic event registration
export const dartService = DartAIService.getInstance();