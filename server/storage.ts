import {
  users,
  families,
  tasks,
  familyTasks,
  documents,
  messages,
  invitations,
  notificationPreferences,
  notificationLogs,
  taskDependencies,
  workflowRules,
  type User,
  type UpsertUser,
  type Family,
  type InsertFamily,
  type Task,
  type InsertTask,
  type FamilyTask,
  type InsertFamilyTask,
  type Document,
  type InsertDocument,
  type Message,
  type InsertMessage,
  type Invitation,
  type InsertInvitation,
  type NotificationPreferences,
  type InsertNotificationPreferences,
  type NotificationLog,
  type InsertNotificationLog,
  type TaskDependency,
  type InsertTaskDependency,
  type WorkflowRule,
  type InsertWorkflowRule,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, lt, gt, inArray, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Family operations
  createFamily(family: InsertFamily): Promise<Family>;
  getFamily(familyId: string): Promise<Family | undefined>;
  getFamilyByCode(familyCode: string): Promise<Family | undefined>;
  getAllFamilies(): Promise<Family[]>;
  getFamilyWithMembers(familyId: string): Promise<(Family & { members: User[] }) | undefined>;
  
  // Task operations
  createTask(task: InsertTask): Promise<Task>;
  getAllTasks(): Promise<Task[]>;
  initializeFamilyTasks(familyId: string): Promise<void>;
  getFamilyTasks(familyId: string): Promise<(FamilyTask & { task: Task })[]>;
  getFamilyTask(familyTaskId: string): Promise<FamilyTask | undefined>;
  getFamilyTaskByFamilyAndTask(familyId: string, taskId: string): Promise<FamilyTask | undefined>;
  getFamilyTaskWithTask(familyTaskId: string): Promise<(FamilyTask & { task: Task }) | undefined>;
  updateFamilyTaskStatus(familyTaskId: string, status: string, notes?: string): Promise<FamilyTask>;
  
  // Document operations
  createDocument(document: InsertDocument): Promise<Document>;
  getFamilyDocuments(familyId: string): Promise<(Document & { uploader: User })[]>;
  getDocument(documentId: string): Promise<Document | undefined>;
  
  // Message operations
  createMessage(message: InsertMessage): Promise<Message>;
  getFamilyMessages(familyId: string): Promise<(Message & { fromUser: User })[]>;
  markMessageAsRead(messageId: string): Promise<void>;
  
  // Invitation operations
  createInvitation(invitation: InsertInvitation): Promise<Invitation>;
  getFamilyInvitations(familyId: string): Promise<(Invitation & { inviter: User })[]>;
  getInvitationByCode(invitationCode: string): Promise<Invitation | undefined>;
  getInvitationsByEmail(email: string): Promise<(Invitation & { family: Family; inviter: User })[]>;
  updateInvitationStatus(invitationId: string, status: string): Promise<Invitation>;
  deleteInvitation(invitationId: string): Promise<void>;
  expireOldInvitations(): Promise<void>;
  
  // Statistics
  getFamilyStats(familyId: string): Promise<{
    completed: number;
    pending: number;
    documents: number;
    progress: number;
  }>;
  getAdminStats(): Promise<{
    totalFamilies: number;
    completedCases: number;
    pendingReviews: number;
    totalDocuments: number;
  }>;
  
  // Admin operations
  getAdminUsers(): Promise<User[]>;
  
  // Notification operations
  getUserNotificationPreferences(userId: string): Promise<NotificationPreferences | undefined>;
  setUserNotificationPreferences(preferences: InsertNotificationPreferences): Promise<NotificationPreferences>;
  getFamilyMembers(familyId: string): Promise<User[]>;
  createNotificationLog(log: InsertNotificationLog): Promise<NotificationLog>;
  findRecentNotificationLog(type: string, recipientUserId: string, entityId: string, sinceMinutes: number): Promise<NotificationLog | undefined>;
  findRecentNotificationLogByEmail(type: string, recipientEmail: string, entityId: string, sinceMinutes: number): Promise<NotificationLog | undefined>;
  
  // Dependency Query Methods
  getTaskDependencies(taskId: string): Promise<(TaskDependency & { dependsOnTask: Task })[]>;
  getTasksBlockedBy(taskId: string): Promise<(TaskDependency & { task: Task })[]>;
  getDependencyChain(taskId: string): Promise<Task[]>;
  getTasksReadyForFamily(familyId: string): Promise<(FamilyTask & { task: Task })[]>;
  
  // Dependency Management Methods
  addTaskDependency(dependency: InsertTaskDependency): Promise<TaskDependency>;
  removeTaskDependency(taskId: string, dependsOnTaskId: string, dependencyType?: string): Promise<void>;
  validateDependencies(taskId: string, familyId: string): Promise<{
    canStart: boolean;
    missingDependencies: string[];
    optionalDependencies: string[];
  }>;
  
  // Workflow Rule Methods
  getActiveWorkflowRules(): Promise<WorkflowRule[]>;
  getWorkflowRulesForTask(taskId: string): Promise<WorkflowRule[]>;
  addWorkflowRule(rule: InsertWorkflowRule): Promise<WorkflowRule>;
  toggleWorkflowRule(ruleId: string, isActive: boolean): Promise<WorkflowRule>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.email,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Family operations
  async createFamily(familyData: InsertFamily): Promise<Family> {
    const [family] = await db.insert(families).values(familyData).returning();
    return family;
  }

  async getFamilyByCode(familyCode: string): Promise<Family | undefined> {
    const [family] = await db
      .select()
      .from(families)
      .where(eq(families.familyCode, familyCode));
    return family;
  }

  async getAllFamilies(): Promise<Family[]> {
    return await db.select().from(families).orderBy(desc(families.createdAt));
  }

  async getFamily(familyId: string): Promise<Family | undefined> {
    const [family] = await db
      .select()
      .from(families)
      .where(eq(families.id, familyId));
    return family;
  }

  async getFamilyWithMembers(familyId: string): Promise<(Family & { members: User[] }) | undefined> {
    const family = await db.query.families.findFirst({
      where: eq(families.id, familyId),
      with: {
        members: true,
      },
    });
    return family;
  }

  // Task operations
  async createTask(taskData: InsertTask): Promise<Task> {
    const [task] = await db.insert(tasks).values(taskData).returning();
    return task;
  }

  async getAllTasks(): Promise<Task[]> {
    return await db.select().from(tasks).orderBy(tasks.order);
  }

  async initializeFamilyTasks(familyId: string): Promise<void> {
    const allTasks = await this.getAllTasks();
    const familyTasksData = allTasks
      .filter(task => task.isTemplate)
      .map(task => ({
        familyId,
        taskId: task.id,
        status: "not_started" as const,
      }));
    
    if (familyTasksData.length > 0) {
      await db.insert(familyTasks).values(familyTasksData);
    }
  }

  async getFamilyTasks(familyId: string): Promise<(FamilyTask & { task: Task })[]> {
    return await db.query.familyTasks.findMany({
      where: eq(familyTasks.familyId, familyId),
      with: {
        task: true,
      },
      orderBy: (familyTasks, { asc }) => [asc(familyTasks.createdAt)],
    });
  }

  async getFamilyTasksWithDependencies(familyId: string): Promise<(FamilyTask & { 
    task: Task;
    dependencies: (TaskDependency & { dependsOnTask: Task })[];
    dependencyStatus: {
      canStart: boolean;
      canComplete: boolean;
      blockedBy: string[];
      dependsOn: string[];
    };
  })[]> {
    // First get all family tasks
    const familyTasks = await this.getFamilyTasks(familyId);
    
    // Create a lookup map for family task statuses by template task ID
    const familyTaskStatusMap = new Map<string, string>();
    familyTasks.forEach(ft => {
      familyTaskStatusMap.set(ft.taskId, ft.status);
    });
    
    // Get dependencies for all tasks and calculate status
    const result = await Promise.all(
      familyTasks.map(async (familyTask) => {
        // Get dependencies for this task
        const dependencies = await this.getTaskDependencies(familyTask.taskId);
        
        // Calculate dependency status
        const dependsOn: string[] = dependencies.map(dep => dep.dependsOnTask.title);
        const blockedBy: string[] = [];
        
        // Check which dependencies are not completed
        for (const dep of dependencies) {
          const depStatus = familyTaskStatusMap.get(dep.dependsOnTaskId);
          if (depStatus !== 'completed') {
            blockedBy.push(dep.dependsOnTask.title);
          }
        }
        
        const canStart = blockedBy.length === 0;
        const canComplete = canStart; // For now, same logic
        
        return {
          ...familyTask,
          dependencies,
          dependencyStatus: {
            canStart,
            canComplete,
            blockedBy,
            dependsOn,
          },
        };
      })
    );
    
    return result;
  }

  async getFamilyTask(familyTaskId: string): Promise<FamilyTask | undefined> {
    const [task] = await db
      .select()
      .from(familyTasks)
      .where(eq(familyTasks.id, familyTaskId));
    return task;
  }

  async getFamilyTaskByFamilyAndTask(familyId: string, taskId: string): Promise<FamilyTask | undefined> {
    const [familyTask] = await db
      .select()
      .from(familyTasks)
      .where(and(eq(familyTasks.familyId, familyId), eq(familyTasks.taskId, taskId)));
    return familyTask;
  }

  async getFamilyTaskWithTask(familyTaskId: string): Promise<(FamilyTask & { task: Task }) | undefined> {
    const familyTask = await db.query.familyTasks.findFirst({
      where: eq(familyTasks.id, familyTaskId),
      with: {
        task: true,
      },
    });
    return familyTask;
  }

  async updateFamilyTaskStatus(familyTaskId: string, status: string, notes?: string): Promise<FamilyTask> {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };
    
    if (notes !== undefined) {
      updateData.notes = notes;
    }
    
    if (status === "completed") {
      updateData.completedAt = new Date();
    }

    const [task] = await db
      .update(familyTasks)
      .set(updateData)
      .where(eq(familyTasks.id, familyTaskId))
      .returning();
    
    return task;
  }

  // Document operations
  async createDocument(documentData: InsertDocument): Promise<Document> {
    const [document] = await db.insert(documents).values(documentData).returning();
    return document;
  }

  async getFamilyDocuments(familyId: string): Promise<(Document & { uploader: User })[]> {
    return await db.query.documents.findMany({
      where: eq(documents.familyId, familyId),
      with: {
        uploader: true,
      },
      orderBy: desc(documents.createdAt),
    });
  }

  async getDocument(documentId: string): Promise<Document | undefined> {
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId));
    return document;
  }

  // Message operations
  async createMessage(messageData: InsertMessage): Promise<Message> {
    const [message] = await db.insert(messages).values(messageData).returning();
    return message;
  }

  async getFamilyMessages(familyId: string): Promise<(Message & { fromUser: User })[]> {
    return await db.query.messages.findMany({
      where: eq(messages.familyId, familyId),
      with: {
        fromUser: true,
      },
      orderBy: desc(messages.createdAt),
    });
  }

  async markMessageAsRead(messageId: string): Promise<void> {
    await db
      .update(messages)
      .set({ isRead: true })
      .where(eq(messages.id, messageId));
  }

  // Statistics
  async getFamilyStats(familyId: string): Promise<{
    completed: number;
    pending: number;
    documents: number;
    progress: number;
  }> {
    const tasks = await db.query.familyTasks.findMany({
      where: eq(familyTasks.familyId, familyId),
    });

    const docs = await db.query.documents.findMany({
      where: eq(documents.familyId, familyId),
    });

    const completed = tasks.filter(task => task.status === "completed").length;
    const pending = tasks.filter(task => task.status !== "completed").length;
    const total = tasks.length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      completed,
      pending,
      documents: docs.length,
      progress,
    };
  }

  async getAdminStats(): Promise<{
    totalFamilies: number;
    completedCases: number;
    pendingReviews: number;
    totalDocuments: number;
  }> {
    const allFamilies = await db.select().from(families);
    const allDocuments = await db.select().from(documents);
    const allFamilyTasks = await db.select().from(familyTasks);

    // Calculate completed cases (families with all tasks completed)
    const completedCases = await Promise.all(
      allFamilies.map(async (family) => {
        const tasks = await db.query.familyTasks.findMany({
          where: eq(familyTasks.familyId, family.id),
        });
        const allCompleted = tasks.every(task => task.status === "completed");
        return allCompleted ? 1 : 0;
      })
    ).then(results => results.reduce((sum: number, val: number) => sum + val, 0));

    const pendingReviews = allFamilyTasks.filter(task => 
      task.status === "in_progress" || task.status === "not_started"
    ).length;

    return {
      totalFamilies: allFamilies.length,
      completedCases,
      pendingReviews,
      totalDocuments: allDocuments.length,
    };
  }

  // Invitation operations
  async createInvitation(invitationData: InsertInvitation): Promise<Invitation> {
    const [invitation] = await db.insert(invitations).values(invitationData).returning();
    return invitation;
  }

  async getFamilyInvitations(familyId: string): Promise<(Invitation & { inviter: User })[]> {
    return await db.query.invitations.findMany({
      where: eq(invitations.familyId, familyId),
      with: {
        inviter: true,
      },
      orderBy: desc(invitations.createdAt),
    });
  }

  async getInvitationByCode(invitationCode: string): Promise<Invitation | undefined> {
    const [invitation] = await db
      .select()
      .from(invitations)
      .where(eq(invitations.invitationCode, invitationCode));
    return invitation;
  }

  async getInvitationsByEmail(email: string): Promise<(Invitation & { family: Family; inviter: User })[]> {
    return await db.query.invitations.findMany({
      where: and(
        eq(invitations.inviteeEmail, email),
        eq(invitations.status, "pending")
      ),
      with: {
        family: true,
        inviter: true,
      },
      orderBy: desc(invitations.createdAt),
    });
  }

  async updateInvitationStatus(invitationId: string, status: string): Promise<Invitation> {
    const [invitation] = await db
      .update(invitations)
      .set({ status })
      .where(eq(invitations.id, invitationId))
      .returning();
    return invitation;
  }

  async deleteInvitation(invitationId: string): Promise<void> {
    await db.delete(invitations).where(eq(invitations.id, invitationId));
  }

  async expireOldInvitations(): Promise<void> {
    await db
      .update(invitations)
      .set({ status: "expired" })
      .where(and(
        eq(invitations.status, "pending"),
        lt(invitations.expiresAt, new Date())
      ));
  }

  // Admin operations
  async getAdminUsers(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, 'admin'));
  }

  // Notification operations
  async getUserNotificationPreferences(userId: string): Promise<NotificationPreferences | undefined> {
    const [preferences] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));
    return preferences;
  }

  async setUserNotificationPreferences(preferences: InsertNotificationPreferences): Promise<NotificationPreferences> {
    const [result] = await db
      .insert(notificationPreferences)
      .values(preferences)
      .onConflictDoUpdate({
        target: notificationPreferences.userId,
        set: {
          ...preferences,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  async getFamilyMembers(familyId: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.familyId, familyId));
  }

  async createNotificationLog(log: InsertNotificationLog): Promise<NotificationLog> {
    const [result] = await db.insert(notificationLogs).values(log).returning();
    return result;
  }

  async findRecentNotificationLog(
    type: string, 
    recipientUserId: string, 
    entityId: string, 
    sinceMinutes: number
  ): Promise<NotificationLog | undefined> {
    const sinceTime = new Date(Date.now() - sinceMinutes * 60 * 1000);
    
    const [log] = await db
      .select()
      .from(notificationLogs)
      .where(and(
        eq(notificationLogs.type, type),
        eq(notificationLogs.recipientUserId, recipientUserId),
        eq(notificationLogs.entityId, entityId),
        gt(notificationLogs.createdAt, sinceTime)
      ))
      .orderBy(desc(notificationLogs.createdAt))
      .limit(1);
    
    return log;
  }

  async findRecentNotificationLogByEmail(
    type: string, 
    recipientEmail: string, 
    entityId: string, 
    sinceMinutes: number
  ): Promise<NotificationLog | undefined> {
    const sinceTime = new Date(Date.now() - sinceMinutes * 60 * 1000);
    
    const [log] = await db
      .select()
      .from(notificationLogs)
      .where(and(
        eq(notificationLogs.type, type),
        eq(notificationLogs.recipientEmail, recipientEmail),
        eq(notificationLogs.entityId, entityId),
        gt(notificationLogs.createdAt, sinceTime)
      ))
      .orderBy(desc(notificationLogs.createdAt))
      .limit(1);
    
    return log;
  }

  // Dependency Query Methods
  async getTaskDependencies(taskId: string): Promise<(TaskDependency & { dependsOnTask: Task })[]> {
    return await db.query.taskDependencies.findMany({
      where: eq(taskDependencies.taskId, taskId),
      with: {
        dependsOnTask: true,
      },
    });
  }

  async getTasksBlockedBy(taskId: string): Promise<(TaskDependency & { task: Task })[]> {
    return await db.query.taskDependencies.findMany({
      where: eq(taskDependencies.dependsOnTaskId, taskId),
      with: {
        task: true,
      },
    });
  }

  async getDependencyChain(taskId: string): Promise<Task[]> {
    const visited = new Set<string>();
    const chain: Task[] = [];
    
    const buildChain = async (currentTaskId: string): Promise<void> => {
      if (visited.has(currentTaskId)) {
        return; // Avoid infinite loops in chain building
      }
      visited.add(currentTaskId);
      
      const dependencies = await this.getTaskDependencies(currentTaskId);
      for (const dep of dependencies) {
        chain.push(dep.dependsOnTask);
        await buildChain(dep.dependsOnTaskId);
      }
    };
    
    await buildChain(taskId);
    return Array.from(new Map(chain.map(task => [task.id, task])).values());
  }

  // Enhanced cycle detection with proper reachability algorithm
  private async detectCircularDependency(startTaskId: string, targetTaskId: string): Promise<{
    hasCycle: boolean;
    cyclePath?: string[];
  }> {
    // Adding dependency startTaskId → targetTaskId creates a cycle if and only if
    // there's already a path from targetTaskId to startTaskId
    
    // 1. Preload all dependencies for efficient traversal
    const allDependencies = await this.batchLoadAllDependencies();
    
    // 2. Build adjacency map for faster lookups
    const adjacencyMap = new Map<string, string[]>();
    allDependencies.forEach((deps, taskId) => {
      adjacencyMap.set(taskId, deps.map((dep: any) => dep.dependsOnTaskId));
    });
    
    // 3. Check if targetTaskId can reach startTaskId using DFS
    const visited = new Set<string>();
    const pathFromTarget: string[] = [];
    
    const findPath = (currentTaskId: string, targetId: string): boolean => {
      if (currentTaskId === targetId) {
        pathFromTarget.push(currentTaskId);
        return true; // Found target - we have a path
      }
      
      if (visited.has(currentTaskId)) {
        return false; // Already visited, no cycle through this path
      }
      
      visited.add(currentTaskId);
      pathFromTarget.push(currentTaskId);
      
      const dependencies = adjacencyMap.get(currentTaskId) || [];
      for (const depTaskId of dependencies) {
        if (findPath(depTaskId, targetId)) {
          return true; // Found path through this dependency
        }
      }
      
      // Backtrack
      pathFromTarget.pop();
      return false;
    };
    
    // Check if targetTaskId can reach startTaskId
    const hasPathToStart = findPath(targetTaskId, startTaskId);
    
    if (hasPathToStart) {
      // Construct the complete cycle path that would be created
      // Path found: targetTaskId → ... → startTaskId
      // Adding startTaskId → targetTaskId would complete the cycle
      const cyclePath = [...pathFromTarget, targetTaskId];
      
      return {
        hasCycle: true,
        cyclePath,
      };
    }
    
    return {
      hasCycle: false,
    };
  }

  async getTasksReadyForFamily(familyId: string): Promise<(FamilyTask & { task: Task })[]> {
    // Optimized version: batch load all data and evaluate in-memory
    const [familyTasks, allDependencies] = await Promise.all([
      this.getFamilyTasks(familyId),
      this.batchLoadAllDependencies()
    ]);
    
    const familyTaskMap = new Map(
      familyTasks.map(ft => [ft.task.id, ft])
    );
    
    const readyTasks: (FamilyTask & { task: Task })[] = [];
    
    for (const familyTask of familyTasks) {
      if (familyTask.status === "not_started") {
        const validation = this.validateDependenciesInMemory(
          familyTask.task.id, 
          familyTaskMap, 
          allDependencies
        );
        if (validation.canStart) {
          readyTasks.push(familyTask);
        }
      }
    }
    
    return readyTasks;
  }

  // Batch load all task dependencies in a single query for performance
  private async batchLoadAllDependencies(): Promise<Map<string, (TaskDependency & { dependsOnTask: Task })[]>> {
    const allDependencies = await db.query.taskDependencies.findMany({
      with: {
        dependsOnTask: true,
      },
    });
    
    const dependencyMap = new Map<string, (TaskDependency & { dependsOnTask: Task })[]>();
    
    for (const dependency of allDependencies) {
      const taskId = dependency.taskId;
      if (!dependencyMap.has(taskId)) {
        dependencyMap.set(taskId, []);
      }
      dependencyMap.get(taskId)!.push(dependency);
    }
    
    return dependencyMap;
  }

  // In-memory dependency validation to avoid repeated DB queries
  private validateDependenciesInMemory(
    taskId: string,
    familyTaskMap: Map<string, FamilyTask & { task: Task }>,
    allDependencies: Map<string, (TaskDependency & { dependsOnTask: Task })[]>
  ): {
    canStart: boolean;
    missingDependencies: string[];
    optionalDependencies: string[];
  } {
    const dependencies = allDependencies.get(taskId) || [];
    const missingDependencies: string[] = [];
    const optionalDependencies: string[] = [];
    
    for (const dep of dependencies) {
      const dependentFamilyTask = familyTaskMap.get(dep.dependsOnTaskId);
      
      if (!dependentFamilyTask || dependentFamilyTask.status !== "completed") {
        if (dep.dependencyType === "required") {
          missingDependencies.push(dep.dependsOnTask.title);
        } else if (dep.dependencyType === "optional") {
          optionalDependencies.push(dep.dependsOnTask.title);
        }
      }
    }
    
    const canStart = missingDependencies.length === 0;
    
    return {
      canStart,
      missingDependencies,
      optionalDependencies,
    };
  }

  // Dependency Management Methods
  async addTaskDependency(dependency: InsertTaskDependency): Promise<TaskDependency> {
    // Prevent self-dependencies
    if (dependency.taskId === dependency.dependsOnTaskId) {
      throw new Error("A task cannot depend on itself");
    }
    
    // Check for circular dependencies using proper reachability algorithm
    const cycleCheck = await this.detectCircularDependency(dependency.taskId, dependency.dependsOnTaskId);
    if (cycleCheck.hasCycle) {
      const cyclePath = cycleCheck.cyclePath?.join(' → ') || 'Unknown cycle path';
      throw new Error(`Adding this dependency would create a circular dependency. Cycle path: ${cyclePath}`);
    }
    
    const [result] = await db.insert(taskDependencies).values(dependency).returning();
    return result;
  }

  async removeTaskDependency(taskId: string, dependsOnTaskId: string, dependencyType?: string): Promise<void> {
    // Build single conditional query instead of rebuilding twice
    const whereConditions = [
      eq(taskDependencies.taskId, taskId),
      eq(taskDependencies.dependsOnTaskId, dependsOnTaskId)
    ];
    
    if (dependencyType) {
      whereConditions.push(eq(taskDependencies.dependencyType, dependencyType));
    }
    
    await db.delete(taskDependencies).where(and(...whereConditions));
  }

  async validateDependencies(taskId: string, familyId: string): Promise<{
    canStart: boolean;
    missingDependencies: string[];
    optionalDependencies: string[];
  }> {
    const dependencies = await this.getTaskDependencies(taskId);
    const familyTasks = await this.getFamilyTasks(familyId);
    
    const familyTaskMap = new Map(
      familyTasks.map(ft => [ft.task.id, ft])
    );
    
    const missingDependencies: string[] = [];
    const optionalDependencies: string[] = [];
    
    for (const dep of dependencies) {
      const dependentFamilyTask = familyTaskMap.get(dep.dependsOnTaskId);
      
      // Handle case where family task doesn't exist yet
      if (!dependentFamilyTask) {
        // Check if this dependency task is a template task that should exist for this family
        const dependentTask = await db.query.tasks.findFirst({
          where: and(
            eq(tasks.id, dep.dependsOnTaskId),
            eq(tasks.isTemplate, true)
          )
        });
        
        if (dependentTask) {
          // This is a template task that should exist but hasn't been initialized
          // Treat as not completed for dependency purposes
          if (dep.dependencyType === "required") {
            missingDependencies.push(dep.dependsOnTask.title);
          } else if (dep.dependencyType === "optional") {
            optionalDependencies.push(dep.dependsOnTask.title);
          }
        }
        // If it's not a template task, ignore this dependency as it may be from another context
        continue;
      }
      
      if (dependentFamilyTask.status !== "completed") {
        if (dep.dependencyType === "required") {
          missingDependencies.push(dep.dependsOnTask.title);
        } else if (dep.dependencyType === "optional") {
          optionalDependencies.push(dep.dependsOnTask.title);
        }
      }
    }
    
    const canStart = missingDependencies.length === 0;
    
    return {
      canStart,
      missingDependencies,
      optionalDependencies,
    };
  }

  // Workflow Rule Methods
  async getActiveWorkflowRules(): Promise<WorkflowRule[]> {
    return await db.select().from(workflowRules).where(eq(workflowRules.isActive, true));
  }

  async getWorkflowRulesForTask(taskId: string): Promise<WorkflowRule[]> {
    return await db.select().from(workflowRules).where(
      and(
        eq(workflowRules.isActive, true),
        eq(workflowRules.triggerTaskId, taskId)
      )
    );
  }

  async addWorkflowRule(rule: InsertWorkflowRule): Promise<WorkflowRule> {
    // Validate referential integrity before inserting
    await this.validateWorkflowRule(rule);
    
    const [result] = await db.insert(workflowRules).values(rule).returning();
    return result;
  }

  // Validate workflow rule referential integrity
  private async validateWorkflowRule(rule: InsertWorkflowRule): Promise<void> {
    const validationErrors: string[] = [];
    
    // Validate trigger task exists if specified
    if (rule.triggerTaskId) {
      const triggerTask = await db.query.tasks.findFirst({
        where: eq(tasks.id, rule.triggerTaskId)
      });
      if (!triggerTask) {
        validationErrors.push(`Trigger task with ID ${rule.triggerTaskId} does not exist`);
      }
    }
    
    // Validate action target based on targetType
    if (rule.targetType === 'task' && rule.actionTargetTaskId) {
      const targetTask = await db.query.tasks.findFirst({
        where: eq(tasks.id, rule.actionTargetTaskId)
      });
      if (!targetTask) {
        validationErrors.push(`Target task with ID ${rule.actionTargetTaskId} does not exist`);
      }
    } else if (rule.targetType === 'user' && rule.actionTargetUserId) {
      const targetUser = await db.query.users.findFirst({
        where: eq(users.id, rule.actionTargetUserId)
      });
      if (!targetUser) {
        validationErrors.push(`Target user with ID ${rule.actionTargetUserId} does not exist`);
      }
    }
    
    // Validate trigger condition matches provided trigger data
    if (rule.triggerCondition === 'task_completed' && !rule.triggerTaskId) {
      validationErrors.push('triggerTaskId is required when triggerCondition is "task_completed"');
    }
    
    if (rule.triggerCondition === 'status_change' && !rule.triggerStatus) {
      validationErrors.push('triggerStatus is required when triggerCondition is "status_change"');
    }
    
    // Validate action matches target type
    const taskActions = ['auto_enable', 'auto_complete'];
    const userActions = ['assign_user', 'send_notification'];
    
    if (taskActions.includes(rule.action) && rule.targetType !== 'task') {
      validationErrors.push(`Action "${rule.action}" requires targetType to be "task"`);
    }
    
    if (userActions.includes(rule.action) && rule.targetType !== 'user') {
      validationErrors.push(`Action "${rule.action}" requires targetType to be "user"`);
    }
    
    // Prevent self-referential rules that could cause infinite loops
    if (rule.triggerTaskId === rule.actionTargetTaskId) {
      validationErrors.push('A workflow rule cannot trigger on and target the same task');
    }
    
    if (validationErrors.length > 0) {
      throw new Error(`Workflow rule validation failed:\n${validationErrors.join('\n')}`);
    }
  }

  async toggleWorkflowRule(ruleId: string, isActive: boolean): Promise<WorkflowRule> {
    const [result] = await db
      .update(workflowRules)
      .set({ isActive })
      .where(eq(workflowRules.id, ruleId))
      .returning();
    return result;
  }
}

export const storage = new DatabaseStorage();
