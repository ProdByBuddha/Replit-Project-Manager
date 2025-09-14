import axios, { AxiosInstance, AxiosError } from "axios";
import { db } from "../db";
import { dartProjects, dartTasks, dartSyncLogs } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

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

interface DartWorkspace {
  dartId: string;
  name: string;
  projects: DartProject[];
}

interface DartProgressReport {
  projectId: string;
  projectName: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overallProgress: number;
  tasksByPriority: {
    urgent: number;
    high: number;
    medium: number;
    low: number;
  };
  tasksByStatus: {
    todo: number;
    in_progress: number;
    completed: number;
    blocked: number;
  };
  lastUpdated: Date;
}

export class DartAIService {
  private apiKey: string;
  private baseUrl = 'https://app.itsdart.com/api/v0';
  private axiosInstance: AxiosInstance;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.DART_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('Dart AI API key not configured. Service will be disabled.');
    }

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 seconds timeout
    });

    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      response => response,
      async error => {
        await this.logSyncError('api_request', error);
        throw error;
      }
    );
  }

  // Check if service is configured
  isConfigured(): boolean {
    return !!this.apiKey;
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

  // Update task progress
  async updateTaskProgress(
    familyTaskId: string,
    progress: number
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn('Dart AI service not configured');
      return false;
    }

    try {
      // Get Dart task ID
      const dartTaskRecord = await db
        .select()
        .from(dartTasks)
        .where(eq(dartTasks.familyTaskId, familyTaskId))
        .limit(1);

      if (dartTaskRecord.length === 0) {
        throw new Error('Task not synced with Dart');
      }

      const dartTaskId = dartTaskRecord[0].dartTaskId;

      // Update progress in Dart
      await this.axiosInstance.patch(`/tasks/${dartTaskId}`, {
        progress: Math.min(100, Math.max(0, progress)),
      });

      // Update local tracking
      await db
        .update(dartTasks)
        .set({
          progress,
          syncStatus: 'synced',
          lastSyncAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(dartTasks.familyTaskId, familyTaskId));

      await this.logSync(
        'task',
        dartTaskId,
        'update',
        'success',
        undefined,
        { progress },
        { success: true }
      );

      return true;
    } catch (error) {
      await this.logSync(
        'task',
        familyTaskId,
        'update',
        'failed',
        undefined,
        { progress },
        null,
        error instanceof Error ? error.message : 'Unknown error',
        error
      );
      return false;
    }
  }

  // Create or update a project in Dart
  async createOrUpdateProject(
    familyId: string,
    data: {
      name: string;
      description?: string;
      workspaceDartId?: string;
    }
  ): Promise<DartProject | null> {
    if (!this.isConfigured()) {
      console.warn('Dart AI service not configured');
      return null;
    }

    try {
      // Check if project already exists
      const existingProject = await db
        .select()
        .from(dartProjects)
        .where(eq(dartProjects.familyId, familyId))
        .limit(1);

      let dartProject: DartProject;
      let operation: 'create' | 'update';

      if (existingProject.length > 0) {
        // Update existing project
        operation = 'update';
        const response = await this.axiosInstance.put(
          `/projects/${existingProject[0].dartProjectId}`,
          {
            name: data.name,
            description: data.description,
          }
        );
        dartProject = response.data;

        // Update local tracking
        await db
          .update(dartProjects)
          .set({
            projectName: data.name,
            projectDescription: data.description,
            syncStatus: 'synced',
            lastSyncAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(dartProjects.id, existingProject[0].id));
      } else {
        // Create new project
        operation = 'create';
        const requestData = {
          name: data.name,
          description: data.description,
          ...(data.workspaceDartId && { workspaceDartId: data.workspaceDartId }),
        };
        
        const response = await this.axiosInstance.post('/projects', requestData);
        dartProject = response.data;

        // Store project mapping
        await db.insert(dartProjects).values({
          familyId,
          dartProjectId: dartProject.dartId,
          dartWorkspaceId: data.workspaceDartId,
          projectName: data.name,
          projectDescription: data.description,
          status: 'active',
          syncStatus: 'synced',
          lastSyncAt: new Date(),
        });
      }

      await this.logSync(
        'project',
        dartProject.dartId,
        operation,
        'success',
        familyId,
        data,
        dartProject
      );

      return dartProject;
    } catch (error) {
      await this.logSync(
        'project',
        familyId,
        'create',
        'failed',
        familyId,
        data,
        null,
        error instanceof Error ? error.message : 'Unknown error',
        error
      );
      throw error;
    }
  }

  // Sync all tasks for a family
  async syncFamilyTasks(
    familyId: string,
    familyTasks: Array<{
      id: string;
      taskId: string;
      title: string;
      description?: string;
      status: string;
      assignedTo?: string;
      notes?: string;
    }>
  ): Promise<{ synced: number; failed: number }> {
    if (!this.isConfigured()) {
      console.warn('Dart AI service not configured');
      return { synced: 0, failed: 0 };
    }

    let synced = 0;
    let failed = 0;

    // Ensure project exists for family
    const project = await db
      .select()
      .from(dartProjects)
      .where(eq(dartProjects.familyId, familyId))
      .limit(1);

    if (project.length === 0) {
      // Create project first
      const familyProject = await this.createOrUpdateProject(familyId, {
        name: `Family ${familyId} Tasks`,
        description: 'Family portal task management',
      });

      if (!familyProject) {
        return { synced: 0, failed: familyTasks.length };
      }
    }

    const projectDartId = project[0]?.dartProjectId || '';

    // Sync each task
    for (const task of familyTasks) {
      try {
        const dartStatus = this.mapStatusToDart(task.status);
        await this.createOrUpdateTask(task.id, {
          title: task.title,
          description: task.description || task.notes,
          status: dartStatus,
          assignee: task.assignedTo,
          projectDartId,
        });
        synced++;
      } catch (error) {
        console.error(`Failed to sync task ${task.id}:`, error);
        failed++;
      }
    }

    return { synced, failed };
  }

  // Map family portal status to Dart status
  private mapStatusToDart(status: string): 'todo' | 'in_progress' | 'completed' | 'blocked' {
    switch (status.toLowerCase()) {
      case 'not_started':
        return 'todo';
      case 'in_progress':
        return 'in_progress';
      case 'completed':
        return 'completed';
      case 'blocked':
      case 'on_hold':
        return 'blocked';
      default:
        return 'todo';
    }
  }

  // Generate progress report
  async generateProgressReport(familyId: string): Promise<DartProgressReport | null> {
    if (!this.isConfigured()) {
      console.warn('Dart AI service not configured');
      return null;
    }

    try {
      // Get project for family
      const project = await db
        .select()
        .from(dartProjects)
        .where(eq(dartProjects.familyId, familyId))
        .limit(1);

      if (project.length === 0) {
        throw new Error('No Dart project found for family');
      }

      // Get all synced tasks
      const tasks = await db
        .select()
        .from(dartTasks)
        .where(eq(dartTasks.dartProjectId, project[0].dartProjectId));

      // Calculate statistics
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === 'completed').length;
      const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
      
      const tasksByPriority = {
        urgent: tasks.filter(t => t.priority === 'urgent').length,
        high: tasks.filter(t => t.priority === 'high').length,
        medium: tasks.filter(t => t.priority === 'medium').length,
        low: tasks.filter(t => t.priority === 'low').length,
      };

      const tasksByStatus = {
        todo: tasks.filter(t => t.status === 'todo').length,
        in_progress: inProgressTasks,
        completed: completedTasks,
        blocked: tasks.filter(t => t.status === 'blocked').length,
      };

      // Calculate overall progress
      const overallProgress = totalTasks > 0
        ? Math.round((completedTasks / totalTasks) * 100)
        : 0;

      const report: DartProgressReport = {
        projectId: project[0].dartProjectId,
        projectName: project[0].projectName,
        totalTasks,
        completedTasks,
        inProgressTasks,
        overallProgress,
        tasksByPriority,
        tasksByStatus,
        lastUpdated: new Date(),
      };

      await this.logSync(
        'project',
        project[0].dartProjectId,
        'sync',
        'success',
        familyId,
        { action: 'generate_report' },
        report
      );

      return report;
    } catch (error) {
      await this.logSync(
        'project',
        familyId,
        'sync',
        'failed',
        familyId,
        { action: 'generate_report' },
        null,
        error instanceof Error ? error.message : 'Unknown error',
        error
      );
      return null;
    }
  }

  // Get workspace information
  async getWorkspace(): Promise<DartWorkspace | null> {
    if (!this.isConfigured()) {
      console.warn('Dart AI service not configured');
      return null;
    }

    try {
      const workspaceId = process.env.DART_WORKSPACE_ID;
      
      if (!workspaceId) {
        // Fetch default workspace
        const response = await this.axiosInstance.get('/workspaces');
        return response.data[0] || null;
      }

      const response = await this.axiosInstance.get(`/workspaces/${workspaceId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch Dart workspace:', error);
      return null;
    }
  }

  // Initialize Dart workspace for a family
  async initializeWorkspace(familyId: string): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn('Dart AI service not configured');
      return false;
    }

    try {
      // Get or create project for family
      const project = await this.createOrUpdateProject(familyId, {
        name: `Family Portal - ${familyId}`,
        description: 'Automated task tracking for family portal',
      });

      if (project) {
        await this.logSync(
          'workspace',
          familyId,
          'create',
          'success',
          familyId,
          { action: 'initialize' },
          project
        );
        return true;
      }

      return false;
    } catch (error) {
      await this.logSync(
        'workspace',
        familyId,
        'create',
        'failed',
        familyId,
        { action: 'initialize' },
        null,
        error instanceof Error ? error.message : 'Unknown error',
        error
      );
      return false;
    }
  }

  // Get sync status for a family
  async getSyncStatus(familyId: string): Promise<{
    projectSynced: boolean;
    lastSyncTime?: Date;
    syncedTasks: number;
    pendingTasks: number;
    failedTasks: number;
  }> {
    const project = await db
      .select()
      .from(dartProjects)
      .where(eq(dartProjects.familyId, familyId))
      .limit(1);

    if (project.length === 0) {
      return {
        projectSynced: false,
        syncedTasks: 0,
        pendingTasks: 0,
        failedTasks: 0,
      };
    }

    const tasks = await db
      .select()
      .from(dartTasks)
      .where(eq(dartTasks.dartProjectId, project[0].dartProjectId));

    const syncedTasks = tasks.filter(t => t.syncStatus === 'synced').length;
    const pendingTasks = tasks.filter(t => t.syncStatus === 'pending').length;
    const failedTasks = tasks.filter(t => t.syncStatus === 'error').length;

    return {
      projectSynced: project[0].syncStatus === 'synced',
      lastSyncTime: project[0].lastSyncAt || undefined,
      syncedTasks,
      pendingTasks,
      failedTasks,
    };
  }
}

// Export singleton instance
export const dartAIService = new DartAIService();