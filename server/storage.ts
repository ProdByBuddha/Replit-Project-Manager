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
  systemSettings,
  usCodeTitles,
  usCodeChapters,
  usCodeSections,
  usCodeCrossReferences,
  usCodeSearchIndex,
  usCodeIndexingJobs,
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
  type SystemSettings,
  type InsertSystemSettings,
  type UsCodeTitle,
  type InsertUsCodeTitle,
  type UsCodeChapter,
  type InsertUsCodeChapter,
  type UsCodeSection,
  type InsertUsCodeSection,
  type UsCodeCrossReference,
  type InsertUsCodeCrossReference,
  type UsCodeSearchIndex,
  type InsertUsCodeSearchIndex,
  type UsCodeIndexingJob,
  type InsertUsCodeIndexingJob,
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
  getAllUsers(): Promise<User[]>;
  
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
  
  // System Settings Methods
  getSystemSettings(): Promise<SystemSettings[]>;
  getSystemSettingsByCategory(category: string): Promise<SystemSettings[]>;
  getSystemSettingByKey(key: string): Promise<SystemSettings | undefined>;
  upsertSystemSetting(setting: InsertSystemSettings): Promise<SystemSettings>;
  updateSystemSetting(key: string, value: any): Promise<SystemSettings>;
  deleteSystemSetting(key: string): Promise<void>;
  
  // ===== US CODE INDEXING OPERATIONS =====
  
  // US Code Title Operations
  createUsCodeTitle(title: InsertUsCodeTitle): Promise<UsCodeTitle>;
  getUsCodeTitle(titleId: string): Promise<UsCodeTitle | undefined>;
  getUsCodeTitleByNumber(titleNumber: number): Promise<UsCodeTitle | undefined>;
  getAllUsCodeTitles(): Promise<UsCodeTitle[]>;
  updateUsCodeTitle(titleId: string, updates: Partial<InsertUsCodeTitle>): Promise<UsCodeTitle>;
  deleteUsCodeTitle(titleId: string): Promise<void>;
  
  // US Code Chapter Operations
  createUsCodeChapter(chapter: InsertUsCodeChapter): Promise<UsCodeChapter>;
  getUsCodeChapter(chapterId: string): Promise<UsCodeChapter | undefined>;
  getChaptersByTitle(titleId: string): Promise<UsCodeChapter[]>;
  updateUsCodeChapter(chapterId: string, updates: Partial<InsertUsCodeChapter>): Promise<UsCodeChapter>;
  deleteUsCodeChapter(chapterId: string): Promise<void>;
  
  // US Code Section Operations
  createUsCodeSection(section: InsertUsCodeSection): Promise<UsCodeSection>;
  getUsCodeSection(sectionId: string): Promise<UsCodeSection | undefined>;
  getUsCodeSectionByCitation(citation: string): Promise<UsCodeSection | undefined>;
  getSectionsByTitle(titleId: string): Promise<UsCodeSection[]>;
  getSectionsByChapter(chapterId: string): Promise<UsCodeSection[]>;
  updateUsCodeSection(sectionId: string, updates: Partial<InsertUsCodeSection>): Promise<UsCodeSection>;
  deleteUsCodeSection(sectionId: string): Promise<void>;
  
  // US Code Cross Reference Operations
  createUsCodeCrossReference(reference: InsertUsCodeCrossReference): Promise<UsCodeCrossReference>;
  getCrossReferencesForSection(sectionId: string): Promise<(UsCodeCrossReference & { toSection: UsCodeSection })[]>;
  getSectionsReferencingSection(sectionId: string): Promise<(UsCodeCrossReference & { fromSection: UsCodeSection })[]>;
  deleteCrossReference(referenceId: string): Promise<void>;
  
  // US Code Search Operations
  searchUsCodeSections(query: string, options?: {
    titleNumber?: number;
    limit?: number;
    offset?: number;
    includeHeadings?: boolean;
    searchType?: 'fulltext' | 'citation' | 'keyword';
  }): Promise<{
    sections: (UsCodeSection & { 
      title: UsCodeTitle;
      chapter?: UsCodeChapter;
      relevanceScore?: number;
    })[];
    totalCount: number;
    searchMetadata: {
      query: string;
      searchType: string;
      executionTime: number;
    };
  }>;
  
  // US Code Search Index Operations
  createUsCodeSearchIndex(searchIndex: InsertUsCodeSearchIndex): Promise<UsCodeSearchIndex>;
  getSearchIndexForSection(sectionId: string): Promise<UsCodeSearchIndex | undefined>;
  updateSearchIndex(sectionId: string, updates: Partial<InsertUsCodeSearchIndex>): Promise<UsCodeSearchIndex>;
  rebuildSearchIndexes(titleNumber?: number): Promise<{ processed: number; errors: number }>;
  
  // US Code Indexing Job Operations
  createIndexingJob(job: InsertUsCodeIndexingJob): Promise<UsCodeIndexingJob>;
  getIndexingJob(jobId: string): Promise<UsCodeIndexingJob | undefined>;
  getActiveIndexingJobs(): Promise<UsCodeIndexingJob[]>;
  getIndexingJobHistory(limit?: number): Promise<UsCodeIndexingJob[]>;
  updateIndexingJobStatus(jobId: string, status: string, progress?: any, stats?: any): Promise<UsCodeIndexingJob>;
  updateIndexingJobError(jobId: string, errorMessage: string): Promise<UsCodeIndexingJob>;
  
  // US Code Statistics and Analytics
  getUsCodeStats(): Promise<{
    totalTitles: number;
    totalChapters: number;
    totalSections: number;
    lastIndexed: Date | null;
    indexingJobs: {
      completed: number;
      failed: number;
      running: number;
    };
    searchStats: {
      totalSearches: number;
      popularSections: string[];
    };
  }>;
  
  // US Code Maintenance Operations
  findOrphanedSections(): Promise<UsCodeSection[]>;
  validateCrossReferences(): Promise<{ valid: number; invalid: number; issues: string[] }>;
  optimizeSearchIndexes(): Promise<{ optimized: number; errors: string[] }>;
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
    return await db.select().from(users).where(eq(users.role, 'ministry_admin'));
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
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

  // System Settings Methods
  async getSystemSettings(): Promise<SystemSettings[]> {
    return await db.select().from(systemSettings).orderBy(systemSettings.category, systemSettings.key);
  }

  async getSystemSettingsByCategory(category: string): Promise<SystemSettings[]> {
    return await db.select().from(systemSettings).where(eq(systemSettings.category, category)).orderBy(systemSettings.key);
  }

  async getSystemSettingByKey(key: string): Promise<SystemSettings | undefined> {
    const [result] = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    return result;
  }

  async upsertSystemSetting(setting: InsertSystemSettings): Promise<SystemSettings> {
    // Check if setting exists
    const existing = await this.getSystemSettingByKey(setting.key);
    
    if (existing) {
      // Update existing setting
      const [result] = await db
        .update(systemSettings)
        .set({
          value: setting.value,
          category: setting.category,
          description: setting.description,
          isReadOnly: setting.isReadOnly,
          updatedAt: new Date(),
        })
        .where(eq(systemSettings.key, setting.key))
        .returning();
      return result;
    } else {
      // Insert new setting
      const [result] = await db.insert(systemSettings).values(setting).returning();
      return result;
    }
  }

  async updateSystemSetting(key: string, value: any): Promise<SystemSettings> {
    const [result] = await db
      .update(systemSettings)
      .set({
        value: value,
        updatedAt: new Date(),
      })
      .where(eq(systemSettings.key, key))
      .returning();
    
    if (!result) {
      throw new Error(`System setting with key "${key}" not found`);
    }
    
    return result;
  }

  async deleteSystemSetting(key: string): Promise<void> {
    await db.delete(systemSettings).where(eq(systemSettings.key, key));
  }

  // ===== US CODE STORAGE IMPLEMENTATIONS =====

  // US Code Title Operations
  async createUsCodeTitle(titleData: InsertUsCodeTitle): Promise<UsCodeTitle> {
    const [title] = await db.insert(usCodeTitles).values(titleData).returning();
    return title;
  }

  async getUsCodeTitle(titleId: string): Promise<UsCodeTitle | undefined> {
    const [title] = await db
      .select()
      .from(usCodeTitles)
      .where(eq(usCodeTitles.id, titleId));
    return title;
  }

  async getUsCodeTitleByNumber(titleNumber: number): Promise<UsCodeTitle | undefined> {
    const [title] = await db
      .select()
      .from(usCodeTitles)
      .where(eq(usCodeTitles.number, titleNumber));
    return title;
  }

  async getAllUsCodeTitles(): Promise<UsCodeTitle[]> {
    return await db
      .select()
      .from(usCodeTitles)
      .orderBy(usCodeTitles.number);
  }

  async updateUsCodeTitle(titleId: string, updates: Partial<InsertUsCodeTitle>): Promise<UsCodeTitle> {
    const [title] = await db
      .update(usCodeTitles)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(usCodeTitles.id, titleId))
      .returning();
    
    if (!title) {
      throw new Error(`US Code title with ID "${titleId}" not found`);
    }
    
    return title;
  }

  async deleteUsCodeTitle(titleId: string): Promise<void> {
    await db.delete(usCodeTitles).where(eq(usCodeTitles.id, titleId));
  }

  // US Code Chapter Operations
  async createUsCodeChapter(chapterData: InsertUsCodeChapter): Promise<UsCodeChapter> {
    const [chapter] = await db.insert(usCodeChapters).values(chapterData).returning();
    return chapter;
  }

  async getUsCodeChapter(chapterId: string): Promise<UsCodeChapter | undefined> {
    const [chapter] = await db
      .select()
      .from(usCodeChapters)
      .where(eq(usCodeChapters.id, chapterId));
    return chapter;
  }

  async getChaptersByTitle(titleId: string): Promise<UsCodeChapter[]> {
    return await db
      .select()
      .from(usCodeChapters)
      .where(eq(usCodeChapters.titleId, titleId))
      .orderBy(usCodeChapters.number);
  }

  async updateUsCodeChapter(chapterId: string, updates: Partial<InsertUsCodeChapter>): Promise<UsCodeChapter> {
    const [chapter] = await db
      .update(usCodeChapters)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(usCodeChapters.id, chapterId))
      .returning();
    
    if (!chapter) {
      throw new Error(`US Code chapter with ID "${chapterId}" not found`);
    }
    
    return chapter;
  }

  async deleteUsCodeChapter(chapterId: string): Promise<void> {
    await db.delete(usCodeChapters).where(eq(usCodeChapters.id, chapterId));
  }

  // US Code Section Operations
  async createUsCodeSection(sectionData: InsertUsCodeSection): Promise<UsCodeSection> {
    const [section] = await db.insert(usCodeSections).values(sectionData).returning();
    return section;
  }

  async getUsCodeSection(sectionId: string): Promise<UsCodeSection | undefined> {
    const [section] = await db
      .select()
      .from(usCodeSections)
      .where(eq(usCodeSections.id, sectionId));
    return section;
  }

  async getUsCodeSectionByCitation(citation: string): Promise<UsCodeSection | undefined> {
    const [section] = await db
      .select()
      .from(usCodeSections)
      .where(eq(usCodeSections.citation, citation));
    return section;
  }

  async getSectionsByTitle(titleId: string): Promise<UsCodeSection[]> {
    return await db
      .select()
      .from(usCodeSections)
      .where(eq(usCodeSections.titleId, titleId))
      .orderBy(usCodeSections.number);
  }

  async getSectionsByChapter(chapterId: string): Promise<UsCodeSection[]> {
    return await db
      .select()
      .from(usCodeSections)
      .where(eq(usCodeSections.chapterId, chapterId))
      .orderBy(usCodeSections.number);
  }

  async updateUsCodeSection(sectionId: string, updates: Partial<InsertUsCodeSection>): Promise<UsCodeSection> {
    const [section] = await db
      .update(usCodeSections)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(usCodeSections.id, sectionId))
      .returning();
    
    if (!section) {
      throw new Error(`US Code section with ID "${sectionId}" not found`);
    }
    
    return section;
  }

  async deleteUsCodeSection(sectionId: string): Promise<void> {
    await db.delete(usCodeSections).where(eq(usCodeSections.id, sectionId));
  }

  // US Code Cross Reference Operations
  async createUsCodeCrossReference(referenceData: InsertUsCodeCrossReference): Promise<UsCodeCrossReference> {
    const [reference] = await db.insert(usCodeCrossReferences).values(referenceData).returning();
    return reference;
  }

  async getCrossReferencesForSection(sectionId: string): Promise<(UsCodeCrossReference & { toSection: UsCodeSection })[]> {
    return await db.query.usCodeCrossReferences.findMany({
      where: eq(usCodeCrossReferences.fromSectionId, sectionId),
      with: {
        toSection: true,
      },
    });
  }

  async getSectionsReferencingSection(sectionId: string): Promise<(UsCodeCrossReference & { fromSection: UsCodeSection })[]> {
    return await db.query.usCodeCrossReferences.findMany({
      where: eq(usCodeCrossReferences.toSectionId, sectionId),
      with: {
        fromSection: true,
      },
    });
  }

  async deleteCrossReference(referenceId: string): Promise<void> {
    await db.delete(usCodeCrossReferences).where(eq(usCodeCrossReferences.id, referenceId));
  }

  // US Code Search Operations
  async searchUsCodeSections(query: string, options: {
    titleNumber?: number;
    limit?: number;
    offset?: number;
    includeHeadings?: boolean;
    searchType?: 'fulltext' | 'citation' | 'keyword';
  } = {}): Promise<{
    sections: (UsCodeSection & { 
      title: UsCodeTitle;
      chapter?: UsCodeChapter;
      relevanceScore?: number;
    })[];
    totalCount: number;
    searchMetadata: {
      query: string;
      searchType: string;
      executionTime: number;
    };
  }> {
    const startTime = Date.now();
    const {
      titleNumber,
      limit = 20,
      offset = 0,
      includeHeadings = true,
      searchType = 'fulltext'
    } = options;

    let searchQuery = db
      .select({
        section: usCodeSections,
        title: usCodeTitles,
        chapter: usCodeChapters,
      })
      .from(usCodeSections)
      .innerJoin(usCodeTitles, eq(usCodeSections.titleId, usCodeTitles.id))
      .leftJoin(usCodeChapters, eq(usCodeSections.chapterId, usCodeChapters.id));

    // Apply search conditions based on search type
    if (searchType === 'citation') {
      // Search by citation pattern
      searchQuery = searchQuery.where(
        sql`${usCodeSections.citation} ILIKE ${`%${query}%`}`
      );
    } else if (searchType === 'keyword') {
      // Search in keywords and content
      searchQuery = searchQuery.where(
        sql`${usCodeSections.content} ILIKE ${`%${query}%`} OR ${usCodeSections.heading} ILIKE ${`%${query}%`}`
      );
    } else {
      // Full-text search using PostgreSQL's text search
      if (includeHeadings) {
        searchQuery = searchQuery.where(
          sql`(to_tsvector('english', ${usCodeSections.content}) @@ plainto_tsquery('english', ${query}) OR to_tsvector('english', ${usCodeSections.heading}) @@ plainto_tsquery('english', ${query}))`
        );
      } else {
        searchQuery = searchQuery.where(
          sql`to_tsvector('english', ${usCodeSections.content}) @@ plainto_tsquery('english', ${query})`
        );
      }
    }

    // Apply title filter if specified
    if (titleNumber) {
      searchQuery = searchQuery.where(eq(usCodeTitles.number, titleNumber));
    }

    // Add ranking for full-text search
    if (searchType === 'fulltext') {
      searchQuery = searchQuery.orderBy(
        sql`ts_rank(to_tsvector('english', ${usCodeSections.content}), plainto_tsquery('english', ${query})) DESC`,
        usCodeSections.citation
      );
    } else {
      searchQuery = searchQuery.orderBy(usCodeSections.citation);
    }

    // Get total count for pagination
    const countQuery = db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(usCodeSections)
      .innerJoin(usCodeTitles, eq(usCodeSections.titleId, usCodeTitles.id));

    // Apply same filters to count query
    if (searchType === 'citation') {
      countQuery.where(sql`${usCodeSections.citation} ILIKE ${`%${query}%`}`);
    } else if (searchType === 'keyword') {
      countQuery.where(
        sql`${usCodeSections.content} ILIKE ${`%${query}%`} OR ${usCodeSections.heading} ILIKE ${`%${query}%`}`
      );
    } else {
      // Full-text search using PostgreSQL's text search
      if (includeHeadings) {
        countQuery.where(
          sql`(to_tsvector('english', ${usCodeSections.content}) @@ plainto_tsquery('english', ${query}) OR to_tsvector('english', ${usCodeSections.heading}) @@ plainto_tsquery('english', ${query}))`
        );
      } else {
        countQuery.where(
          sql`to_tsvector('english', ${usCodeSections.content}) @@ plainto_tsquery('english', ${query})`
        );
      }
    }

    if (titleNumber) {
      countQuery.where(eq(usCodeTitles.number, titleNumber));
    }

    // Execute queries
    const [results, countResult] = await Promise.all([
      searchQuery.limit(limit).offset(offset),
      countQuery
    ]);

    const totalCount = countResult[0]?.count || 0;
    const executionTime = Date.now() - startTime;

    // Format results
    const sections = results.map(result => ({
      ...result.section,
      title: result.title,
      chapter: result.chapter || undefined,
      relevanceScore: searchType === 'fulltext' ? Math.random() : undefined, // Placeholder for ranking
    }));

    return {
      sections,
      totalCount,
      searchMetadata: {
        query,
        searchType,
        executionTime,
      },
    };
  }

  // US Code Search Index Operations
  async createUsCodeSearchIndex(searchIndexData: InsertUsCodeSearchIndex): Promise<UsCodeSearchIndex> {
    const [searchIndex] = await db.insert(usCodeSearchIndex).values(searchIndexData).returning();
    return searchIndex;
  }

  async getSearchIndexForSection(sectionId: string): Promise<UsCodeSearchIndex | undefined> {
    const [searchIndex] = await db
      .select()
      .from(usCodeSearchIndex)
      .where(eq(usCodeSearchIndex.sectionId, sectionId));
    return searchIndex;
  }

  async updateSearchIndex(sectionId: string, updates: Partial<InsertUsCodeSearchIndex>): Promise<UsCodeSearchIndex> {
    const [searchIndex] = await db
      .update(usCodeSearchIndex)
      .set({
        ...updates,
        lastUpdated: new Date(),
      })
      .where(eq(usCodeSearchIndex.sectionId, sectionId))
      .returning();
    
    if (!searchIndex) {
      throw new Error(`Search index for section ID "${sectionId}" not found`);
    }
    
    return searchIndex;
  }

  async rebuildSearchIndexes(titleNumber?: number): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    try {
      // Get sections to process
      let sectionsQuery = db.select().from(usCodeSections);
      
      if (titleNumber) {
        const title = await this.getUsCodeTitleByNumber(titleNumber);
        if (title) {
          sectionsQuery = sectionsQuery.where(eq(usCodeSections.titleId, title.id));
        }
      }

      const sections = await sectionsQuery;

      // Process each section
      for (const section of sections) {
        try {
          // Extract keywords and topics (simplified implementation)
          const keywords = this.extractKeywordsFromContent(section.content);
          const topics = this.classifyLegalContent(section.content);
          
          // Create or update search index
          const searchContent = `${section.heading} ${section.content}`;
          
          await db
            .insert(usCodeSearchIndex)
            .values({
              sectionId: section.id,
              searchContent,
              keywords,
              topics,
              lastUpdated: new Date(),
            })
            .onConflictDoUpdate({
              target: usCodeSearchIndex.sectionId,
              set: {
                searchContent,
                keywords,
                topics,
                lastUpdated: new Date(),
              },
            });

          processed++;
        } catch (error) {
          errors++;
          console.error(`Error processing section ${section.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in rebuildSearchIndexes:', error);
      errors++;
    }

    return { processed, errors };
  }

  // US Code Indexing Job Operations
  async createIndexingJob(jobData: InsertUsCodeIndexingJob): Promise<UsCodeIndexingJob> {
    const [job] = await db.insert(usCodeIndexingJobs).values(jobData).returning();
    return job;
  }

  async getIndexingJob(jobId: string): Promise<UsCodeIndexingJob | undefined> {
    const [job] = await db
      .select()
      .from(usCodeIndexingJobs)
      .where(eq(usCodeIndexingJobs.id, jobId));
    return job;
  }

  async getActiveIndexingJobs(): Promise<UsCodeIndexingJob[]> {
    return await db
      .select()
      .from(usCodeIndexingJobs)
      .where(inArray(usCodeIndexingJobs.status, ['pending', 'running']))
      .orderBy(desc(usCodeIndexingJobs.createdAt));
  }

  async getIndexingJobHistory(limit: number = 50): Promise<UsCodeIndexingJob[]> {
    return await db
      .select()
      .from(usCodeIndexingJobs)
      .orderBy(desc(usCodeIndexingJobs.createdAt))
      .limit(limit);
  }

  async updateIndexingJobStatus(jobId: string, status: string, progress?: any, stats?: any): Promise<UsCodeIndexingJob> {
    const updateData: any = {
      status,
      ...(progress && { progress }),
      ...(stats && { stats }),
    };

    if (status === 'running' && !updateData.startedAt) {
      updateData.startedAt = new Date();
    } else if (status === 'completed' || status === 'failed') {
      updateData.completedAt = new Date();
    }

    const [job] = await db
      .update(usCodeIndexingJobs)
      .set(updateData)
      .where(eq(usCodeIndexingJobs.id, jobId))
      .returning();
    
    if (!job) {
      throw new Error(`Indexing job with ID "${jobId}" not found`);
    }
    
    return job;
  }

  async updateIndexingJobError(jobId: string, errorMessage: string): Promise<UsCodeIndexingJob> {
    const [job] = await db
      .update(usCodeIndexingJobs)
      .set({
        status: 'failed',
        errorMessage,
        completedAt: new Date(),
      })
      .where(eq(usCodeIndexingJobs.id, jobId))
      .returning();
    
    if (!job) {
      throw new Error(`Indexing job with ID "${jobId}" not found`);
    }
    
    return job;
  }

  // US Code Statistics and Analytics
  async getUsCodeStats(): Promise<{
    totalTitles: number;
    totalChapters: number;
    totalSections: number;
    lastIndexed: Date | null;
    indexingJobs: {
      completed: number;
      failed: number;
      running: number;
    };
    searchStats: {
      totalSearches: number;
      popularSections: string[];
    };
  }> {
    const [titleCount, chapterCount, sectionCount, lastIndexedResult, jobStats] = await Promise.all([
      db.select({ count: sql`count(*)`.mapWith(Number) }).from(usCodeTitles),
      db.select({ count: sql`count(*)`.mapWith(Number) }).from(usCodeChapters),
      db.select({ count: sql`count(*)`.mapWith(Number) }).from(usCodeSections),
      db.select({ lastIndexed: sql`max(${usCodeTitles.lastIndexed})` }).from(usCodeTitles),
      db.select({
        status: usCodeIndexingJobs.status,
        count: sql`count(*)`.mapWith(Number),
      }).from(usCodeIndexingJobs).groupBy(usCodeIndexingJobs.status),
    ]);

    const jobStatistics = {
      completed: 0,
      failed: 0,
      running: 0,
    };

    jobStats.forEach(stat => {
      if (stat.status === 'completed') jobStatistics.completed = stat.count;
      else if (stat.status === 'failed') jobStatistics.failed = stat.count;
      else if (stat.status === 'running') jobStatistics.running = stat.count;
    });

    // Get popular sections (simplified - would need actual search tracking)
    const popularSections = await db
      .select({ citation: usCodeSections.citation })
      .from(usCodeSections)
      .limit(10);

    return {
      totalTitles: titleCount[0]?.count || 0,
      totalChapters: chapterCount[0]?.count || 0,
      totalSections: sectionCount[0]?.count || 0,
      lastIndexed: lastIndexedResult[0]?.lastIndexed || null,
      indexingJobs: jobStatistics,
      searchStats: {
        totalSearches: 0, // Would need search tracking
        popularSections: popularSections.map(s => s.citation),
      },
    };
  }

  // US Code Maintenance Operations
  async findOrphanedSections(): Promise<UsCodeSection[]> {
    return await db
      .select()
      .from(usCodeSections)
      .leftJoin(usCodeTitles, eq(usCodeSections.titleId, usCodeTitles.id))
      .where(sql`${usCodeTitles.id} IS NULL`);
  }

  async validateCrossReferences(): Promise<{ valid: number; invalid: number; issues: string[] }> {
    let valid = 0;
    let invalid = 0;
    const issues: string[] = [];

    try {
      const references = await db.select().from(usCodeCrossReferences);

      for (const ref of references) {
        const [fromSection, toSection] = await Promise.all([
          this.getUsCodeSection(ref.fromSectionId),
          this.getUsCodeSection(ref.toSectionId),
        ]);

        if (!fromSection) {
          invalid++;
          issues.push(`Reference ${ref.id}: From section ${ref.fromSectionId} not found`);
        } else if (!toSection) {
          invalid++;
          issues.push(`Reference ${ref.id}: To section ${ref.toSectionId} not found`);
        } else {
          valid++;
        }
      }
    } catch (error) {
      issues.push(`Error validating cross references: ${error}`);
    }

    return { valid, invalid, issues };
  }

  async optimizeSearchIndexes(): Promise<{ optimized: number; errors: string[] }> {
    const errors: string[] = [];
    let optimized = 0;

    try {
      // Run PostgreSQL optimization commands
      await db.execute(sql`VACUUM ANALYZE us_code_sections`);
      await db.execute(sql`VACUUM ANALYZE us_code_search_index`);
      optimized += 2;

      // Reindex text search indexes
      await db.execute(sql`REINDEX INDEX CONCURRENTLY IF EXISTS IDX_us_code_sections_content_text`);
      await db.execute(sql`REINDEX INDEX CONCURRENTLY IF EXISTS IDX_us_code_sections_heading_text`);
      optimized += 2;

    } catch (error) {
      errors.push(`Error optimizing indexes: ${error}`);
    }

    return { optimized, errors };
  }

  // Helper methods for content processing
  private extractKeywordsFromContent(content: string): string[] {
    // Simplified keyword extraction
    const legalTerms = [
      'shall', 'may', 'must', 'required', 'prohibited', 'unlawful',
      'penalty', 'fine', 'liability', 'damages', 'jurisdiction',
      'enforcement', 'compliance', 'violation', 'regulation'
    ];

    const words = content.toLowerCase().split(/\W+/);
    const keywords = legalTerms.filter(term => words.includes(term));
    
    return [...new Set(keywords)]; // Remove duplicates
  }

  private classifyLegalContent(content: string): string[] {
    const topics: string[] = [];
    const contentLower = content.toLowerCase();

    if (/criminal|crime|felony|misdemeanor/.test(contentLower)) {
      topics.push('criminal');
    }
    if (/civil|liability|damages/.test(contentLower)) {
      topics.push('civil');
    }
    if (/regulation|compliance|administrative/.test(contentLower)) {
      topics.push('regulatory');
    }
    if (/procedure|process|hearing/.test(contentLower)) {
      topics.push('procedure');
    }

    return topics;
  }
}

export const storage = new DatabaseStorage();
