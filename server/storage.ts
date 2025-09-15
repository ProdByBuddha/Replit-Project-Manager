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
  familyConnections,
  connectionCodes,
  chatRooms,
  chatMessages,
  usCodeTitles,
  usCodeChapters,
  usCodeSections,
  usCodeCrossReferences,
  usCodeSearchIndex,
  usCodeIndexingJobs,
  uccArticles,
  uccParts,
  uccSections,
  uccSubsections,
  uccCrossReferences,
  uccDefinitions,
  uccSearchIndex,
  uccIndexingJobs,
  savingsAnalyses,
  categorySavings,
  featureClusterSavings,
  calibrationData,
  savingsRecommendations,
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
  type FamilyConnection,
  type InsertFamilyConnection,
  type ConnectionCode,
  type InsertConnectionCode,
  type ChatRoom,
  type InsertChatRoom,
  type ChatMessage,
  type InsertChatMessage,
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
  type UccArticle,
  type InsertUccArticle,
  type UccPart,
  type InsertUccPart,
  type UccSection,
  type InsertUccSection,
  type UccSubsection,
  type InsertUccSubsection,
  type UccCrossReference,
  type InsertUccCrossReference,
  type UccDefinition,
  type InsertUccDefinition,
  type UccSearchIndex,
  type InsertUccSearchIndex,
  type UccIndexingJob,
  type InsertUccIndexingJob,
  type SavingsAnalysis,
  type InsertSavingsAnalysis,
  type CategorySavings,
  type InsertCategorySavings,
  type FeatureClusterSavings,
  type InsertFeatureClusterSavings,
  type CalibrationData,
  type InsertCalibrationData,
  type SavingsRecommendation,
  type InsertSavingsRecommendation,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, lt, gt, inArray, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getUserProfile(userId: string): Promise<(User & { familyCode?: string }) | undefined>;
  updateUserProfile(userId: string, updates: { 
    firstName: string;
    lastName: string;
    phone?: string;
    emailNotifications: boolean;
    darkMode: boolean;
  }): Promise<User>;
  
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
  getSystemSetting(key: string): Promise<SystemSettings | undefined>;
  upsertSystemSetting(setting: InsertSystemSettings): Promise<SystemSettings>;
  setSystemSetting(key: string, value: any): Promise<SystemSettings>;
  updateSystemSetting(key: string, value: any): Promise<SystemSettings>;
  deleteSystemSetting(key: string): Promise<void>;
  
  // ===== FAMILY CONNECTION AND CHAT OPERATIONS =====
  
  // Connection Management
  createConnectionCode(familyId: string, code: string, expiresAt: Date, maxUses?: number): Promise<ConnectionCode>;
  getConnectionCodeByCode(code: string): Promise<ConnectionCode | undefined>;
  useConnectionCode(code: string): Promise<ConnectionCode>;
  expireConnectionCode(codeId: string): Promise<void>;
  createFamilyConnection(inviterFamilyId: string, inviteeFamilyId: string): Promise<FamilyConnection>;
  acceptConnection(connectionId: string): Promise<FamilyConnection>;
  revokeConnection(connectionId: string): Promise<FamilyConnection>;
  getFamilyConnections(familyId: string): Promise<FamilyConnection[]>;
  getConnectionById(connectionId: string): Promise<FamilyConnection | undefined>;
  
  // Chat Room Management
  createFamilyRoom(familyId: string, title: string, createdBy: string): Promise<ChatRoom>;
  createInterfamilyRoom(connectionId: string, title: string, createdBy: string): Promise<ChatRoom>;
  getRoomById(roomId: string): Promise<ChatRoom | undefined>;
  getRoomsForFamily(familyId: string): Promise<ChatRoom[]>;
  canAccessRoom(userId: string, roomId: string): Promise<boolean>;
  
  // Message Management
  createMessage(roomId: string, senderUserId: string, content: string): Promise<ChatMessage>;
  getMessagesByRoom(roomId: string, limit?: number, cursor?: string): Promise<ChatMessage[]>;
  getLatestMessages(roomId: string, limit?: number): Promise<ChatMessage[]>;
  
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
  getLastIndexingJobByType(jobType: string): Promise<UsCodeIndexingJob | undefined>;
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
  
  // ===== UCC (UNIFORM COMMERCIAL CODE) OPERATIONS =====
  
  // UCC Article Operations
  createUccArticle(article: InsertUccArticle): Promise<UccArticle>;
  getUccArticle(articleId: string): Promise<UccArticle | undefined>;
  getUccArticleByNumber(articleNumber: string): Promise<UccArticle | undefined>;
  getAllUccArticles(): Promise<UccArticle[]>;
  updateUccArticle(articleId: string, updates: Partial<InsertUccArticle>): Promise<UccArticle>;
  deleteUccArticle(articleId: string): Promise<void>;
  
  // UCC Part Operations
  createUccPart(part: InsertUccPart): Promise<UccPart>;
  getUccPart(partId: string): Promise<UccPart | undefined>;
  getPartsByArticle(articleId: string): Promise<UccPart[]>;
  updateUccPart(partId: string, updates: Partial<InsertUccPart>): Promise<UccPart>;
  deleteUccPart(partId: string): Promise<void>;
  
  // UCC Section Operations
  createUccSection(section: InsertUccSection): Promise<UccSection>;
  getUccSection(sectionId: string): Promise<UccSection | undefined>;
  getUccSectionByCitation(citation: string): Promise<UccSection | undefined>;
  getSectionsByArticle(articleId: string): Promise<UccSection[]>;
  getSectionsByPart(partId: string): Promise<UccSection[]>;
  updateUccSection(sectionId: string, updates: Partial<InsertUccSection>): Promise<UccSection>;
  deleteUccSection(sectionId: string): Promise<void>;
  
  // UCC Subsection Operations
  createUccSubsection(subsection: InsertUccSubsection): Promise<UccSubsection>;
  getUccSubsection(subsectionId: string): Promise<UccSubsection | undefined>;
  getSubsectionsBySection(sectionId: string): Promise<UccSubsection[]>;
  getSubsectionsByParent(parentSubsectionId: string): Promise<UccSubsection[]>;
  updateUccSubsection(subsectionId: string, updates: Partial<InsertUccSubsection>): Promise<UccSubsection>;
  deleteUccSubsection(subsectionId: string): Promise<void>;
  
  // UCC Cross Reference Operations
  createUccCrossReference(reference: InsertUccCrossReference): Promise<UccCrossReference>;
  getCrossReferencesForUccSection(sectionId: string): Promise<(UccCrossReference & { toSection?: UccSection })[]>;
  getUccSectionsReferencingSection(sectionId: string): Promise<(UccCrossReference & { fromSection: UccSection })[]>;
  getExternalReferencesFromUcc(sectionId: string): Promise<UccCrossReference[]>;
  deleteUccCrossReference(referenceId: string): Promise<void>;
  
  // UCC Definition Operations
  createUccDefinition(definition: InsertUccDefinition): Promise<UccDefinition>;
  getUccDefinition(definitionId: string): Promise<UccDefinition | undefined>;
  getDefinitionsByTerm(term: string): Promise<(UccDefinition & { section: UccSection; article: UccArticle })[]>;
  getDefinitionsBySection(sectionId: string): Promise<UccDefinition[]>;
  getDefinitionsByArticle(articleId: string): Promise<UccDefinition[]>;
  searchUccDefinitions(query: string): Promise<(UccDefinition & { section: UccSection; article: UccArticle })[]>;
  updateUccDefinition(definitionId: string, updates: Partial<InsertUccDefinition>): Promise<UccDefinition>;
  deleteUccDefinition(definitionId: string): Promise<void>;
  
  // UCC Search Operations
  searchUccSections(query: string, options?: {
    articleNumber?: string;
    limit?: number;
    offset?: number;
    includeHeadings?: boolean;
    includeComments?: boolean;
    searchType?: 'fulltext' | 'citation' | 'keyword' | 'definition';
  }): Promise<{
    sections: (UccSection & { 
      article: UccArticle;
      part?: UccPart;
      relevanceScore?: number;
    })[];
    totalCount: number;
    searchMetadata: {
      query: string;
      searchType: string;
      executionTime: number;
    };
  }>;
  
  // UCC Search Index Operations
  createUccSearchIndex(searchIndex: InsertUccSearchIndex): Promise<UccSearchIndex>;
  getUccSearchIndexForSection(sectionId: string): Promise<UccSearchIndex | undefined>;
  updateUccSearchIndex(sectionId: string, updates: Partial<InsertUccSearchIndex>): Promise<UccSearchIndex>;
  rebuildUccSearchIndexes(articleNumber?: string): Promise<{ processed: number; errors: number }>;
  
  // UCC Indexing Job Operations
  createUccIndexingJob(job: InsertUccIndexingJob): Promise<UccIndexingJob>;
  getUccIndexingJob(jobId: string): Promise<UccIndexingJob | undefined>;
  getActiveUccIndexingJobs(): Promise<UccIndexingJob[]>;
  getUccIndexingJobHistory(limit?: number): Promise<UccIndexingJob[]>;
  getLastUccIndexingJobByType(jobType: string): Promise<UccIndexingJob | undefined>;
  updateUccIndexingJobStatus(jobId: string, status: string, progress?: any, stats?: any): Promise<UccIndexingJob>;
  updateUccIndexingJobError(jobId: string, errorMessage: string): Promise<UccIndexingJob>;
  
  // UCC Statistics and Analytics
  getUccStats(): Promise<{
    totalArticles: number;
    totalParts: number;
    totalSections: number;
    totalDefinitions: number;
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
  
  // UCC Maintenance Operations
  findOrphanedUccSections(): Promise<UccSection[]>;
  validateUccCrossReferences(): Promise<{ valid: number; invalid: number; issues: string[] }>;
  optimizeUccSearchIndexes(): Promise<{ optimized: number; errors: string[] }>;
  
  // Combined US Code + UCC Search Operations
  searchLegalSections(query: string, options?: {
    includeUSCode?: boolean;
    includeUCC?: boolean;
    limit?: number;
    offset?: number;
    searchType?: 'fulltext' | 'citation' | 'keyword';
  }): Promise<{
    results: Array<{
      type: 'uscode' | 'ucc';
      section: UsCodeSection | UccSection;
      title?: UsCodeTitle;
      article?: UccArticle;
      chapter?: UsCodeChapter;
      part?: UccPart;
      relevanceScore?: number;
    }>;
    totalCount: number;
    searchMetadata: {
      query: string;
      searchType: string;
      executionTime: number;
    };
  }>;

  // ===== SAVINGS CALCULATION OPERATIONS =====
  
  // Savings Analysis Operations
  createSavingsAnalysis(analysis: InsertSavingsAnalysis): Promise<SavingsAnalysis>;
  getSavingsAnalysis(analysisId: string): Promise<SavingsAnalysis | undefined>;
  getSavingsAnalysesByFamily(familyId: string, limit?: number): Promise<SavingsAnalysis[]>;
  getSavingsAnalysesByProject(projectId: string, limit?: number): Promise<SavingsAnalysis[]>;
  getLatestSavingsAnalysis(familyId?: string): Promise<SavingsAnalysis | undefined>;
  updateSavingsAnalysis(analysisId: string, updates: Partial<InsertSavingsAnalysis>): Promise<SavingsAnalysis>;
  deleteSavingsAnalysis(analysisId: string): Promise<void>;
  
  // Category Savings Operations
  createCategorySavings(categorySavings: InsertCategorySavings[]): Promise<CategorySavings[]>;
  getCategorySavingsByAnalysis(analysisId: string): Promise<CategorySavings[]>;
  getCategorySavingsByCategory(category: string, familyId?: string): Promise<CategorySavings[]>;
  updateCategorySavings(categorySavingsId: string, updates: Partial<InsertCategorySavings>): Promise<CategorySavings>;
  deleteCategorySavingsByAnalysis(analysisId: string): Promise<void>;
  
  // Feature Cluster Savings Operations
  createFeatureClusterSavings(clusterSavings: InsertFeatureClusterSavings[]): Promise<FeatureClusterSavings[]>;
  getFeatureClusterSavingsByAnalysis(analysisId: string): Promise<FeatureClusterSavings[]>;
  getTopPerformingClusters(familyId?: string, limit?: number): Promise<FeatureClusterSavings[]>;
  updateFeatureClusterSavings(clusterSavingsId: string, updates: Partial<InsertFeatureClusterSavings>): Promise<FeatureClusterSavings>;
  deleteFeatureClusterSavingsByAnalysis(analysisId: string): Promise<void>;
  
  // Calibration Data Operations
  createCalibrationData(calibration: InsertCalibrationData): Promise<CalibrationData>;
  getCalibrationData(calibrationId: string): Promise<CalibrationData | undefined>;
  getCalibrationDataByCategory(category: string, familyId?: string, projectType?: string): Promise<CalibrationData | undefined>;
  getAllCalibrationData(familyId?: string): Promise<CalibrationData[]>;
  updateCalibrationData(calibrationId: string, updates: Partial<InsertCalibrationData>): Promise<CalibrationData>;
  deleteCalibrationData(calibrationId: string): Promise<void>;
  upsertCalibrationData(calibration: InsertCalibrationData): Promise<CalibrationData>;
  
  // Savings Recommendations Operations
  createSavingsRecommendations(recommendations: InsertSavingsRecommendation[]): Promise<SavingsRecommendation[]>;
  getSavingsRecommendationsByAnalysis(analysisId: string): Promise<SavingsRecommendation[]>;
  getSavingsRecommendationsByPriority(priority: string, familyId?: string): Promise<SavingsRecommendation[]>;
  updateSavingsRecommendationStatus(recommendationId: string, status: string, actualImpact?: { savings?: number; efficiency?: number }): Promise<SavingsRecommendation>;
  deleteSavingsRecommendationsByAnalysis(analysisId: string): Promise<void>;
  
  // Savings Analytics and Reporting
  getSavingsTrends(familyId?: string, months?: number): Promise<{
    totalSavings: number;
    savingsOverTime: Array<{
      period: string;
      savings: number;
      efficiency: number;
    }>;
    topCategories: Array<{
      category: string;
      totalSavings: number;
      averageEfficiency: number;
    }>;
    recommendations: {
      implemented: number;
      pending: number;
      totalPotentialSavings: number;
    };
  }>;
  
  getSavingsMetrics(familyId?: string): Promise<{
    totalAnalyses: number;
    totalSavings: number;
    averageEfficiency: number;
    bestPerformingCategory: string;
    worstPerformingCategory: string;
    lastAnalysisDate: Date | null;
    calibrationAccuracy: number;
  }>;
  
  // Savings Comparison Operations
  compareSavingsAnalyses(analysisIds: string[]): Promise<{
    analyses: SavingsAnalysis[];
    comparison: {
      totalSavingsComparison: Array<{ analysisId: string; savings: number; percentage: number }>;
      categoryComparison: Record<string, Array<{ analysisId: string; savings: number }>>;
      efficiencyTrends: Array<{ analysisId: string; efficiency: number; date: string }>;
      recommendationSuccess: Array<{ analysisId: string; implementedCount: number; successRate: number }>;
    };
  }>;
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

  async getUserProfile(userId: string): Promise<(User & { familyCode?: string }) | undefined> {
    const user = await this.getUser(userId);
    if (!user) return undefined;
    
    // If user has a family, get the family code
    if (user.familyId) {
      const family = await this.getFamily(user.familyId);
      if (family) {
        return { ...user, familyCode: family.familyCode };
      }
    }
    
    return user;
  }

  async updateUserProfile(
    userId: string, 
    updates: { 
      firstName: string;
      lastName: string;
      phone?: string;
      emailNotifications: boolean;
      darkMode: boolean;
    }
  ): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({
        firstName: updates.firstName,
        lastName: updates.lastName,
        phone: updates.phone,
        emailNotifications: updates.emailNotifications,
        darkMode: updates.darkMode,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    
    return updatedUser;
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
      const insertedTasks = await db.insert(familyTasks).values(familyTasksData).returning();
      
      // Sync new tasks to Eric Parker/Tasks
      try {
        const { taskSyncService } = await import('./services/taskSync');
        for (const familyTask of insertedTasks) {
          await taskSyncService.syncTask(familyTask.id);
        }
        console.log(`[Storage] Synced ${insertedTasks.length} tasks to Eric Parker/Tasks for family ${familyId}`);
      } catch (error) {
        console.error('[Storage] Failed to sync tasks to Dart AI:', error);
      }
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
    // Legacy admin users no longer exist in the RBAC system
    // All users now have proper roles (family, executor, elder, legislator, ministry_admin, platform_admin)
    // This function returns empty array as there are no legacy admin users to migrate
    return [];
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

  async getSystemSetting(key: string): Promise<SystemSettings | undefined> {
    // Alias for getSystemSettingByKey for compatibility
    return this.getSystemSettingByKey(key);
  }

  async setSystemSetting(key: string, value: any): Promise<SystemSettings> {
    // Check if setting exists
    const existing = await this.getSystemSettingByKey(key);
    
    if (existing) {
      // Update existing setting
      return this.updateSystemSetting(key, value);
    } else {
      // Create new setting with reasonable defaults
      const setting: InsertSystemSettings = {
        key,
        value,
        category: 'scheduler', // Default category for scheduler settings
        description: `Auto-generated setting for ${key}`,
        isReadOnly: false,
      };
      return this.upsertSystemSetting(setting);
    }
  }

  // ===== FAMILY CONNECTION AND CHAT IMPLEMENTATIONS =====

  // Connection Management
  async createConnectionCode(familyId: string, code: string, expiresAt: Date, maxUses?: number): Promise<ConnectionCode> {
    const [connectionCode] = await db.insert(connectionCodes).values({
      familyId,
      code,
      expiresAt,
      maxUses: maxUses || 1,
      status: 'active'
    }).returning();
    return connectionCode;
  }

  async getConnectionCodeByCode(code: string): Promise<ConnectionCode | undefined> {
    const [connectionCode] = await db
      .select()
      .from(connectionCodes)
      .where(eq(connectionCodes.code, code));
    return connectionCode;
  }

  async useConnectionCode(code: string): Promise<ConnectionCode> {
    const [connectionCode] = await db
      .update(connectionCodes)
      .set({ 
        usedCount: sql`${connectionCodes.usedCount} + 1` 
      })
      .where(eq(connectionCodes.code, code))
      .returning();
    return connectionCode;
  }

  async expireConnectionCode(codeId: string): Promise<void> {
    await db
      .update(connectionCodes)
      .set({ status: 'expired' })
      .where(eq(connectionCodes.id, codeId));
  }

  async createFamilyConnection(inviterFamilyId: string, inviteeFamilyId: string): Promise<FamilyConnection> {
    const [connection] = await db.insert(familyConnections).values({
      inviterFamilyId,
      inviteeFamilyId,
      status: 'pending'
    }).returning();
    return connection;
  }

  async acceptConnection(connectionId: string): Promise<FamilyConnection> {
    const [connection] = await db
      .update(familyConnections)
      .set({ 
        status: 'accepted',
        acceptedAt: new Date()
      })
      .where(eq(familyConnections.id, connectionId))
      .returning();
    return connection;
  }

  async revokeConnection(connectionId: string): Promise<FamilyConnection> {
    const [connection] = await db
      .update(familyConnections)
      .set({ status: 'revoked' })
      .where(eq(familyConnections.id, connectionId))
      .returning();
    return connection;
  }

  async getFamilyConnections(familyId: string): Promise<FamilyConnection[]> {
    const connections = await db
      .select()
      .from(familyConnections)
      .where(
        sql`${familyConnections.inviterFamilyId} = ${familyId} OR ${familyConnections.inviteeFamilyId} = ${familyId}`
      );
    return connections;
  }

  async getConnectionById(connectionId: string): Promise<FamilyConnection | undefined> {
    const [connection] = await db
      .select()
      .from(familyConnections)
      .where(eq(familyConnections.id, connectionId));
    return connection;
  }

  // Chat Room Management
  async createFamilyRoom(familyId: string, title: string, createdBy: string): Promise<ChatRoom> {
    const [room] = await db.insert(chatRooms).values({
      type: 'family',
      familyId,
      title,
      createdBy
    }).returning();
    return room;
  }

  async createInterfamilyRoom(connectionId: string, title: string, createdBy: string): Promise<ChatRoom> {
    const [room] = await db.insert(chatRooms).values({
      type: 'interfamily',
      connectionId,
      title,
      createdBy
    }).returning();
    return room;
  }

  async getRoomById(roomId: string): Promise<ChatRoom | undefined> {
    const [room] = await db
      .select()
      .from(chatRooms)
      .where(eq(chatRooms.id, roomId));
    return room;
  }

  async getRoomsForFamily(familyId: string): Promise<ChatRoom[]> {
    // Get family room and interfamily rooms via connections
    const familyRooms = await db
      .select()
      .from(chatRooms)
      .where(
        and(
          eq(chatRooms.type, 'family'),
          eq(chatRooms.familyId, familyId)
        )
      );

    const connections = await this.getFamilyConnections(familyId);
    const connectionIds = connections
      .filter(c => c.status === 'accepted')
      .map(c => c.id);

    let interfamilyRooms: ChatRoom[] = [];
    if (connectionIds.length > 0) {
      interfamilyRooms = await db
        .select()
        .from(chatRooms)
        .where(
          and(
            eq(chatRooms.type, 'interfamily'),
            inArray(chatRooms.connectionId, connectionIds)
          )
        );
    }

    return [...familyRooms, ...interfamilyRooms];
  }

  async canAccessRoom(userId: string, roomId: string): Promise<boolean> {
    // Get user and room details
    const user = await this.getUser(userId);
    if (!user || !user.familyId) return false;

    const room = await this.getRoomById(roomId);
    if (!room) return false;

    // Check family room access
    if (room.type === 'family') {
      return room.familyId === user.familyId;
    }

    // Check interfamily room access
    if (room.type === 'interfamily' && room.connectionId) {
      const connection = await this.getConnectionById(room.connectionId);
      if (!connection || connection.status !== 'accepted') return false;
      
      return connection.inviterFamilyId === user.familyId || 
             connection.inviteeFamilyId === user.familyId;
    }

    return false;
  }

  // Message Management
  async createMessage(roomId: string, senderUserId: string, content: string): Promise<ChatMessage> {
    const [message] = await db.insert(chatMessages).values({
      roomId,
      senderUserId,
      content
    }).returning();
    return message;
  }

  async getMessagesByRoom(roomId: string, limit: number = 50, cursor?: string): Promise<ChatMessage[]> {
    const conditions = cursor 
      ? and(
          eq(chatMessages.roomId, roomId),
          lt(chatMessages.createdAt, new Date(cursor))
        )
      : eq(chatMessages.roomId, roomId);

    const messages = await db
      .select()
      .from(chatMessages)
      .where(conditions)
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);

    return messages.reverse(); // Return in chronological order
  }

  async getLatestMessages(roomId: string, limit: number = 20): Promise<ChatMessage[]> {
    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.roomId, roomId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
    
    return messages.reverse(); // Return in chronological order
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

  async getLastIndexingJobByType(jobType: string): Promise<UsCodeIndexingJob | undefined> {
    const [job] = await db
      .select()
      .from(usCodeIndexingJobs)
      .where(eq(usCodeIndexingJobs.jobType, jobType))
      .orderBy(desc(usCodeIndexingJobs.createdAt))
      .limit(1);
    return job;
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

  // ===== UCC (UNIFORM COMMERCIAL CODE) IMPLEMENTATIONS =====

  // UCC Article Operations
  async createUccArticle(articleData: InsertUccArticle): Promise<UccArticle> {
    const [article] = await db.insert(uccArticles).values(articleData).returning();
    return article;
  }

  async getUccArticle(articleId: string): Promise<UccArticle | undefined> {
    const [article] = await db.select().from(uccArticles).where(eq(uccArticles.id, articleId));
    return article;
  }

  async getUccArticleByNumber(articleNumber: string): Promise<UccArticle | undefined> {
    const [article] = await db.select().from(uccArticles).where(eq(uccArticles.number, articleNumber));
    return article;
  }

  async getAllUccArticles(): Promise<UccArticle[]> {
    return await db.select().from(uccArticles).orderBy(uccArticles.number);
  }

  async updateUccArticle(articleId: string, updates: Partial<InsertUccArticle>): Promise<UccArticle> {
    const [article] = await db
      .update(uccArticles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(uccArticles.id, articleId))
      .returning();
    return article;
  }

  async deleteUccArticle(articleId: string): Promise<void> {
    await db.delete(uccArticles).where(eq(uccArticles.id, articleId));
  }

  // UCC Part Operations
  async createUccPart(partData: InsertUccPart): Promise<UccPart> {
    const [part] = await db.insert(uccParts).values(partData).returning();
    return part;
  }

  async getUccPart(partId: string): Promise<UccPart | undefined> {
    const [part] = await db.select().from(uccParts).where(eq(uccParts.id, partId));
    return part;
  }

  async getPartsByArticle(articleId: string): Promise<UccPart[]> {
    return await db.select().from(uccParts).where(eq(uccParts.articleId, articleId)).orderBy(uccParts.number);
  }

  async updateUccPart(partId: string, updates: Partial<InsertUccPart>): Promise<UccPart> {
    const [part] = await db
      .update(uccParts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(uccParts.id, partId))
      .returning();
    return part;
  }

  async deleteUccPart(partId: string): Promise<void> {
    await db.delete(uccParts).where(eq(uccParts.id, partId));
  }

  // UCC Section Operations
  async createUccSection(sectionData: InsertUccSection): Promise<UccSection> {
    const [section] = await db.insert(uccSections).values(sectionData).returning();
    return section;
  }

  async getUccSection(sectionId: string): Promise<UccSection | undefined> {
    const [section] = await db.select().from(uccSections).where(eq(uccSections.id, sectionId));
    return section;
  }

  async getUccSectionByCitation(citation: string): Promise<UccSection | undefined> {
    const [section] = await db.select().from(uccSections).where(eq(uccSections.citation, citation));
    return section;
  }

  async getSectionsByArticle(articleId: string): Promise<UccSection[]> {
    return await db.select().from(uccSections).where(eq(uccSections.articleId, articleId)).orderBy(uccSections.number);
  }

  async getSectionsByPart(partId: string): Promise<UccSection[]> {
    return await db.select().from(uccSections).where(eq(uccSections.partId, partId)).orderBy(uccSections.number);
  }

  async updateUccSection(sectionId: string, updates: Partial<InsertUccSection>): Promise<UccSection> {
    const [section] = await db
      .update(uccSections)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(uccSections.id, sectionId))
      .returning();
    return section;
  }

  async deleteUccSection(sectionId: string): Promise<void> {
    await db.delete(uccSections).where(eq(uccSections.id, sectionId));
  }

  // UCC Subsection Operations
  async createUccSubsection(subsectionData: InsertUccSubsection): Promise<UccSubsection> {
    const [subsection] = await db.insert(uccSubsections).values(subsectionData).returning();
    return subsection;
  }

  async getUccSubsection(subsectionId: string): Promise<UccSubsection | undefined> {
    const [subsection] = await db.select().from(uccSubsections).where(eq(uccSubsections.id, subsectionId));
    return subsection;
  }

  async getSubsectionsBySection(sectionId: string): Promise<UccSubsection[]> {
    return await db
      .select()
      .from(uccSubsections)
      .where(eq(uccSubsections.sectionId, sectionId))
      .orderBy(uccSubsections.level, uccSubsections.order);
  }

  async getSubsectionsByParent(parentSubsectionId: string): Promise<UccSubsection[]> {
    return await db
      .select()
      .from(uccSubsections)
      .where(eq(uccSubsections.parentSubsectionId, parentSubsectionId))
      .orderBy(uccSubsections.order);
  }

  async updateUccSubsection(subsectionId: string, updates: Partial<InsertUccSubsection>): Promise<UccSubsection> {
    const [subsection] = await db
      .update(uccSubsections)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(uccSubsections.id, subsectionId))
      .returning();
    return subsection;
  }

  async deleteUccSubsection(subsectionId: string): Promise<void> {
    await db.delete(uccSubsections).where(eq(uccSubsections.id, subsectionId));
  }

  // UCC Cross Reference Operations
  async createUccCrossReference(referenceData: InsertUccCrossReference): Promise<UccCrossReference> {
    const [reference] = await db.insert(uccCrossReferences).values(referenceData).returning();
    return reference;
  }

  async getCrossReferencesForUccSection(sectionId: string): Promise<(UccCrossReference & { toSection?: UccSection })[]> {
    const references = await db.select().from(uccCrossReferences).where(eq(uccCrossReferences.fromSectionId, sectionId));
    
    const referencesWithSections = await Promise.all(
      references.map(async (ref) => {
        if (ref.toSectionId) {
          const toSection = await this.getUccSection(ref.toSectionId);
          return { ...ref, toSection };
        }
        return { ...ref, toSection: undefined };
      })
    );

    return referencesWithSections;
  }

  async getUccSectionsReferencingSection(sectionId: string): Promise<(UccCrossReference & { fromSection: UccSection })[]> {
    const references = await db.select().from(uccCrossReferences).where(eq(uccCrossReferences.toSectionId, sectionId));
    
    const referencesWithSections = await Promise.all(
      references.map(async (ref) => {
        const fromSection = await this.getUccSection(ref.fromSectionId);
        return { ...ref, fromSection: fromSection! };
      })
    );

    return referencesWithSections.filter(ref => ref.fromSection);
  }

  async getExternalReferencesFromUcc(sectionId: string): Promise<UccCrossReference[]> {
    return await db
      .select()
      .from(uccCrossReferences)
      .where(
        and(
          eq(uccCrossReferences.fromSectionId, sectionId),
          eq(uccCrossReferences.referenceType, "external")
        )
      );
  }

  async deleteUccCrossReference(referenceId: string): Promise<void> {
    await db.delete(uccCrossReferences).where(eq(uccCrossReferences.id, referenceId));
  }

  // UCC Definition Operations
  async createUccDefinition(definitionData: InsertUccDefinition): Promise<UccDefinition> {
    const [definition] = await db.insert(uccDefinitions).values(definitionData).returning();
    return definition;
  }

  async getUccDefinition(definitionId: string): Promise<UccDefinition | undefined> {
    const [definition] = await db.select().from(uccDefinitions).where(eq(uccDefinitions.id, definitionId));
    return definition;
  }

  async getDefinitionsByTerm(term: string): Promise<(UccDefinition & { section: UccSection; article: UccArticle })[]> {
    const definitions = await db.select().from(uccDefinitions).where(eq(uccDefinitions.term, term));
    
    const definitionsWithRelations = await Promise.all(
      definitions.map(async (def) => {
        const [section, article] = await Promise.all([
          this.getUccSection(def.sectionId),
          this.getUccArticle(def.articleId),
        ]);
        return { ...def, section: section!, article: article! };
      })
    );

    return definitionsWithRelations.filter(def => def.section && def.article);
  }

  async getDefinitionsBySection(sectionId: string): Promise<UccDefinition[]> {
    return await db.select().from(uccDefinitions).where(eq(uccDefinitions.sectionId, sectionId));
  }

  async getDefinitionsByArticle(articleId: string): Promise<UccDefinition[]> {
    return await db.select().from(uccDefinitions).where(eq(uccDefinitions.articleId, articleId));
  }

  async searchUccDefinitions(query: string): Promise<(UccDefinition & { section: UccSection; article: UccArticle })[]> {
    const definitions = await db
      .select()
      .from(uccDefinitions)
      .where(
        sql`${uccDefinitions.term} ILIKE ${'%' + query + '%'} OR ${uccDefinitions.definition} ILIKE ${'%' + query + '%'}`
      )
      .limit(50);

    const definitionsWithRelations = await Promise.all(
      definitions.map(async (def) => {
        const [section, article] = await Promise.all([
          this.getUccSection(def.sectionId),
          this.getUccArticle(def.articleId),
        ]);
        return { ...def, section: section!, article: article! };
      })
    );

    return definitionsWithRelations.filter(def => def.section && def.article);
  }

  async updateUccDefinition(definitionId: string, updates: Partial<InsertUccDefinition>): Promise<UccDefinition> {
    const [definition] = await db
      .update(uccDefinitions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(uccDefinitions.id, definitionId))
      .returning();
    return definition;
  }

  async deleteUccDefinition(definitionId: string): Promise<void> {
    await db.delete(uccDefinitions).where(eq(uccDefinitions.id, definitionId));
  }

  // UCC Search Operations
  async searchUccSections(query: string, options: {
    articleNumber?: string;
    limit?: number;
    offset?: number;
    includeHeadings?: boolean;
    includeComments?: boolean;
    searchType?: 'fulltext' | 'citation' | 'keyword' | 'definition';
  } = {}): Promise<{
    sections: (UccSection & { 
      article: UccArticle;
      part?: UccPart;
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
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    const searchType = options.searchType || 'fulltext';

    let whereConditions = [];
    
    if (options.articleNumber) {
      whereConditions.push(sql`${uccArticles.number} = ${options.articleNumber}`);
    }

    if (searchType === 'citation') {
      whereConditions.push(sql`${uccSections.citation} ILIKE ${'%' + query + '%'}`);
    } else if (searchType === 'keyword') {
      whereConditions.push(sql`(${uccSections.heading} ILIKE ${'%' + query + '%'} OR ${uccSections.content} ILIKE ${'%' + query + '%'})`);
    } else {
      whereConditions.push(sql`(${uccSections.heading} ILIKE ${'%' + query + '%'} OR ${uccSections.content} ILIKE ${'%' + query + '%'} OR ${uccSections.officialComment} ILIKE ${'%' + query + '%'})`);
    }

    const sections = await db
      .select()
      .from(uccSections)
      .leftJoin(uccArticles, eq(uccSections.articleId, uccArticles.id))
      .leftJoin(uccParts, eq(uccSections.partId, uccParts.id))
      .where(and(...whereConditions))
      .limit(limit)
      .offset(offset);

    const results = sections.map(row => ({
      ...row.ucc_sections,
      article: row.ucc_articles!,
      part: row.ucc_parts || undefined,
      relevanceScore: 1.0, // Simplified relevance scoring
    }));

    return {
      sections: results,
      totalCount: results.length, // Simplified count for now
      searchMetadata: {
        query,
        searchType,
        executionTime: Date.now() - startTime,
      },
    };
  }

  // UCC Search Index Operations
  async createUccSearchIndex(searchIndexData: InsertUccSearchIndex): Promise<UccSearchIndex> {
    const [searchIndex] = await db.insert(uccSearchIndex).values(searchIndexData).returning();
    return searchIndex;
  }

  async getUccSearchIndexForSection(sectionId: string): Promise<UccSearchIndex | undefined> {
    const [searchIndex] = await db.select().from(uccSearchIndex).where(eq(uccSearchIndex.sectionId, sectionId));
    return searchIndex;
  }

  async updateUccSearchIndex(sectionId: string, updates: Partial<InsertUccSearchIndex>): Promise<UccSearchIndex> {
    const [searchIndex] = await db
      .update(uccSearchIndex)
      .set({ ...updates, lastUpdated: new Date() })
      .where(eq(uccSearchIndex.sectionId, sectionId))
      .returning();
    return searchIndex;
  }

  async rebuildUccSearchIndexes(articleNumber?: string): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    try {
      let sectionsQuery;
      if (articleNumber) {
        sectionsQuery = db
          .select()
          .from(uccSections)
          .leftJoin(uccArticles, eq(uccSections.articleId, uccArticles.id))
          .where(eq(uccArticles.number, articleNumber));
      } else {
        sectionsQuery = db.select().from(uccSections);
      }

      const sections = await sectionsQuery;

      for (const section of sections) {
        try {
          const sectionData = 'ucc_sections' in section ? section.ucc_sections : section;
          const searchContent = `${sectionData.heading} ${sectionData.content} ${sectionData.officialComment || ''}`;
          
          await db
            .insert(uccSearchIndex)
            .values({
              sectionId: sectionData.id,
              searchContent,
              keywords: this.extractKeywordsFromContent(searchContent),
              topics: this.classifyLegalContent(searchContent),
              commercialTerms: [],
              transactionTypes: [],
            })
            .onConflictDoUpdate({
              target: uccSearchIndex.sectionId,
              set: {
                searchContent,
                lastUpdated: new Date(),
              },
            });

          processed++;
        } catch (error) {
          errors++;
        }
      }
    } catch (error) {
      errors++;
    }

    return { processed, errors };
  }

  // UCC Indexing Job Operations
  async createUccIndexingJob(jobData: InsertUccIndexingJob): Promise<UccIndexingJob> {
    const [job] = await db.insert(uccIndexingJobs).values(jobData).returning();
    return job;
  }

  async getUccIndexingJob(jobId: string): Promise<UccIndexingJob | undefined> {
    const [job] = await db.select().from(uccIndexingJobs).where(eq(uccIndexingJobs.id, jobId));
    return job;
  }

  async getActiveUccIndexingJobs(): Promise<UccIndexingJob[]> {
    return await db
      .select()
      .from(uccIndexingJobs)
      .where(inArray(uccIndexingJobs.status, ["pending", "running"]));
  }

  async getUccIndexingJobHistory(limit: number = 50): Promise<UccIndexingJob[]> {
    return await db
      .select()
      .from(uccIndexingJobs)
      .orderBy(desc(uccIndexingJobs.createdAt))
      .limit(limit);
  }

  async getLastUccIndexingJobByType(jobType: string): Promise<UccIndexingJob | undefined> {
    const [job] = await db
      .select()
      .from(uccIndexingJobs)
      .where(eq(uccIndexingJobs.jobType, jobType))
      .orderBy(desc(uccIndexingJobs.createdAt))
      .limit(1);
    return job;
  }

  async updateUccIndexingJobStatus(jobId: string, status: string, progress?: any, stats?: any): Promise<UccIndexingJob> {
    const updateData: any = { status };
    
    if (status === "running" && !progress) {
      updateData.startedAt = new Date();
    } else if (status === "completed" || status === "failed") {
      updateData.completedAt = new Date();
    }

    if (progress) updateData.progress = progress;
    if (stats) updateData.stats = stats;

    const [job] = await db
      .update(uccIndexingJobs)
      .set(updateData)
      .where(eq(uccIndexingJobs.id, jobId))
      .returning();
    return job;
  }

  async updateUccIndexingJobError(jobId: string, errorMessage: string): Promise<UccIndexingJob> {
    const [job] = await db
      .update(uccIndexingJobs)
      .set({
        status: "failed",
        errorMessage,
        completedAt: new Date(),
      })
      .where(eq(uccIndexingJobs.id, jobId))
      .returning();
    return job;
  }

  // UCC Statistics and Analytics
  async getUccStats(): Promise<{
    totalArticles: number;
    totalParts: number;
    totalSections: number;
    totalDefinitions: number;
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
    const [
      articlesCount,
      partsCount,
      sectionsCount,
      definitionsCount,
      completedJobs,
      failedJobs,
      runningJobs,
      lastJob,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(uccArticles),
      db.select({ count: sql<number>`count(*)` }).from(uccParts),
      db.select({ count: sql<number>`count(*)` }).from(uccSections),
      db.select({ count: sql<number>`count(*)` }).from(uccDefinitions),
      db.select({ count: sql<number>`count(*)` }).from(uccIndexingJobs).where(eq(uccIndexingJobs.status, "completed")),
      db.select({ count: sql<number>`count(*)` }).from(uccIndexingJobs).where(eq(uccIndexingJobs.status, "failed")),
      db.select({ count: sql<number>`count(*)` }).from(uccIndexingJobs).where(eq(uccIndexingJobs.status, "running")),
      db.select().from(uccIndexingJobs).orderBy(desc(uccIndexingJobs.completedAt)).limit(1),
    ]);

    return {
      totalArticles: articlesCount[0]?.count || 0,
      totalParts: partsCount[0]?.count || 0,
      totalSections: sectionsCount[0]?.count || 0,
      totalDefinitions: definitionsCount[0]?.count || 0,
      lastIndexed: lastJob[0]?.completedAt || null,
      indexingJobs: {
        completed: completedJobs[0]?.count || 0,
        failed: failedJobs[0]?.count || 0,
        running: runningJobs[0]?.count || 0,
      },
      searchStats: {
        totalSearches: 0, // Would be tracked in application analytics
        popularSections: [], // Would be derived from search frequency
      },
    };
  }

  // UCC Maintenance Operations
  async findOrphanedUccSections(): Promise<UccSection[]> {
    return await db
      .select()
      .from(uccSections)
      .leftJoin(uccArticles, eq(uccSections.articleId, uccArticles.id))
      .where(sql`${uccArticles.id} IS NULL`)
      .then(rows => rows.map(row => row.ucc_sections));
  }

  async validateUccCrossReferences(): Promise<{ valid: number; invalid: number; issues: string[] }> {
    let valid = 0;
    let invalid = 0;
    const issues: string[] = [];

    try {
      const references = await db.select().from(uccCrossReferences);

      for (const ref of references) {
        if (ref.toSectionId) {
          const [fromSection, toSection] = await Promise.all([
            this.getUccSection(ref.fromSectionId),
            this.getUccSection(ref.toSectionId),
          ]);

          if (!fromSection) {
            invalid++;
            issues.push(`UCC Reference ${ref.id}: From section ${ref.fromSectionId} not found`);
          } else if (!toSection) {
            invalid++;
            issues.push(`UCC Reference ${ref.id}: To section ${ref.toSectionId} not found`);
          } else {
            valid++;
          }
        } else if (ref.externalReference) {
          // External reference - just check if from section exists
          const fromSection = await this.getUccSection(ref.fromSectionId);
          if (!fromSection) {
            invalid++;
            issues.push(`UCC Reference ${ref.id}: From section ${ref.fromSectionId} not found`);
          } else {
            valid++;
          }
        }
      }
    } catch (error) {
      issues.push(`Error validating UCC cross references: ${error}`);
    }

    return { valid, invalid, issues };
  }

  async optimizeUccSearchIndexes(): Promise<{ optimized: number; errors: string[] }> {
    const errors: string[] = [];
    let optimized = 0;

    try {
      // Run PostgreSQL optimization commands for UCC tables
      await db.execute(sql`VACUUM ANALYZE ucc_sections`);
      await db.execute(sql`VACUUM ANALYZE ucc_search_index`);
      optimized += 2;

      // Reindex text search indexes
      await db.execute(sql`REINDEX INDEX CONCURRENTLY IF EXISTS IDX_ucc_sections_content_text`);
      await db.execute(sql`REINDEX INDEX CONCURRENTLY IF EXISTS IDX_ucc_sections_heading_text`);
      optimized += 2;

    } catch (error) {
      errors.push(`Error optimizing UCC indexes: ${error}`);
    }

    return { optimized, errors };
  }

  // Combined US Code + UCC Search Operations
  async searchLegalSections(query: string, options: {
    includeUSCode?: boolean;
    includeUCC?: boolean;
    limit?: number;
    offset?: number;
    searchType?: 'fulltext' | 'citation' | 'keyword';
  } = {}): Promise<{
    results: Array<{
      type: 'uscode' | 'ucc';
      section: UsCodeSection | UccSection;
      title?: UsCodeTitle;
      article?: UccArticle;
      chapter?: UsCodeChapter;
      part?: UccPart;
      relevanceScore?: number;
    }>;
    totalCount: number;
    searchMetadata: {
      query: string;
      searchType: string;
      executionTime: number;
    };
  }> {
    const startTime = Date.now();
    const includeUSCode = options.includeUSCode !== false;
    const includeUCC = options.includeUCC !== false;
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    const searchType = options.searchType || 'fulltext';

    const results: Array<{
      type: 'uscode' | 'ucc';
      section: UsCodeSection | UccSection;
      title?: UsCodeTitle;
      article?: UccArticle;
      chapter?: UsCodeChapter;
      part?: UccPart;
      relevanceScore?: number;
    }> = [];

    try {
      // Search US Code if requested
      if (includeUSCode) {
        const usCodeResults = await this.searchUsCodeSections(query, {
          limit: Math.floor(limit / 2),
          offset,
          searchType,
        });

        results.push(...usCodeResults.sections.map(section => ({
          type: 'uscode' as const,
          section,
          title: section.title,
          chapter: section.chapter,
          relevanceScore: section.relevanceScore,
        })));
      }

      // Search UCC if requested
      if (includeUCC) {
        const uccResults = await this.searchUccSections(query, {
          limit: Math.floor(limit / 2),
          offset,
          searchType,
        });

        results.push(...uccResults.sections.map(section => ({
          type: 'ucc' as const,
          section,
          article: section.article,
          part: section.part,
          relevanceScore: section.relevanceScore,
        })));
      }

      // Sort by relevance score if available
      results.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

      return {
        results: results.slice(0, limit),
        totalCount: results.length,
        searchMetadata: {
          query,
          searchType,
          executionTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        results: [],
        totalCount: 0,
        searchMetadata: {
          query,
          searchType,
          executionTime: Date.now() - startTime,
        },
      };
    }
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

  // ===== SAVINGS CALCULATION STORAGE OPERATIONS =====
  
  // Savings Analysis Operations
  async createSavingsAnalysis(analysisData: InsertSavingsAnalysis): Promise<SavingsAnalysis> {
    const [analysis] = await db.insert(savingsAnalyses).values(analysisData).returning();
    return analysis;
  }

  async getSavingsAnalysis(analysisId: string): Promise<SavingsAnalysis | undefined> {
    const [analysis] = await db.select().from(savingsAnalyses).where(eq(savingsAnalyses.id, analysisId));
    return analysis;
  }

  async getSavingsAnalysesByFamily(familyId: string, limit = 10): Promise<SavingsAnalysis[]> {
    return await db
      .select()
      .from(savingsAnalyses)
      .where(eq(savingsAnalyses.familyId, familyId))
      .orderBy(desc(savingsAnalyses.calculatedAt))
      .limit(limit);
  }

  async getSavingsAnalysesByProject(projectId: string, limit = 10): Promise<SavingsAnalysis[]> {
    return await db
      .select()
      .from(savingsAnalyses)
      .where(eq(savingsAnalyses.projectId, projectId))
      .orderBy(desc(savingsAnalyses.calculatedAt))
      .limit(limit);
  }

  async getLatestSavingsAnalysis(familyId?: string): Promise<SavingsAnalysis | undefined> {
    let query = db.select().from(savingsAnalyses).orderBy(desc(savingsAnalyses.calculatedAt)).limit(1);
    
    if (familyId) {
      query = query.where(eq(savingsAnalyses.familyId, familyId));
    }
    
    const [analysis] = await query;
    return analysis;
  }

  async updateSavingsAnalysis(analysisId: string, updates: Partial<InsertSavingsAnalysis>): Promise<SavingsAnalysis> {
    const [updated] = await db
      .update(savingsAnalyses)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(savingsAnalyses.id, analysisId))
      .returning();
    return updated;
  }

  async deleteSavingsAnalysis(analysisId: string): Promise<void> {
    // Delete related data first
    await db.delete(savingsRecommendations).where(eq(savingsRecommendations.savingsAnalysisId, analysisId));
    await db.delete(featureClusterSavings).where(eq(featureClusterSavings.savingsAnalysisId, analysisId));
    await db.delete(categorySavings).where(eq(categorySavings.savingsAnalysisId, analysisId));
    await db.delete(savingsAnalyses).where(eq(savingsAnalyses.id, analysisId));
  }

  // Category Savings Operations
  async createCategorySavings(categorySavingsData: InsertCategorySavings[]): Promise<CategorySavings[]> {
    return await db.insert(categorySavings).values(categorySavingsData).returning();
  }

  async getCategorySavingsByAnalysis(analysisId: string): Promise<CategorySavings[]> {
    return await db
      .select()
      .from(categorySavings)
      .where(eq(categorySavings.savingsAnalysisId, analysisId))
      .orderBy(desc(categorySavings.savingsDollars));
  }

  async getCategorySavingsByCategory(category: string, familyId?: string): Promise<CategorySavings[]> {
    let query = db
      .select()
      .from(categorySavings)
      .innerJoin(savingsAnalyses, eq(categorySavings.savingsAnalysisId, savingsAnalyses.id))
      .where(eq(categorySavings.category, category))
      .orderBy(desc(savingsAnalyses.calculatedAt));
    
    if (familyId) {
      query = query.where(eq(savingsAnalyses.familyId, familyId));
    }
    
    const results = await query;
    return results.map(result => result.category_savings);
  }

  async updateCategorySavings(categorySavingsId: string, updates: Partial<InsertCategorySavings>): Promise<CategorySavings> {
    const [updated] = await db
      .update(categorySavings)
      .set(updates)
      .where(eq(categorySavings.id, categorySavingsId))
      .returning();
    return updated;
  }

  async deleteCategorySavingsByAnalysis(analysisId: string): Promise<void> {
    await db.delete(categorySavings).where(eq(categorySavings.savingsAnalysisId, analysisId));
  }

  // Feature Cluster Savings Operations
  async createFeatureClusterSavings(clusterSavingsData: InsertFeatureClusterSavings[]): Promise<FeatureClusterSavings[]> {
    return await db.insert(featureClusterSavings).values(clusterSavingsData).returning();
  }

  async getFeatureClusterSavingsByAnalysis(analysisId: string): Promise<FeatureClusterSavings[]> {
    return await db
      .select()
      .from(featureClusterSavings)
      .where(eq(featureClusterSavings.savingsAnalysisId, analysisId))
      .orderBy(featureClusterSavings.savingsRank);
  }

  async getTopPerformingClusters(familyId?: string, limit = 10): Promise<FeatureClusterSavings[]> {
    let query = db
      .select()
      .from(featureClusterSavings)
      .innerJoin(savingsAnalyses, eq(featureClusterSavings.savingsAnalysisId, savingsAnalyses.id))
      .orderBy(featureClusterSavings.efficiencyRank)
      .limit(limit);
    
    if (familyId) {
      query = query.where(eq(savingsAnalyses.familyId, familyId));
    }
    
    const results = await query;
    return results.map(result => result.feature_cluster_savings);
  }

  async updateFeatureClusterSavings(clusterSavingsId: string, updates: Partial<InsertFeatureClusterSavings>): Promise<FeatureClusterSavings> {
    const [updated] = await db
      .update(featureClusterSavings)
      .set(updates)
      .where(eq(featureClusterSavings.id, clusterSavingsId))
      .returning();
    return updated;
  }

  async deleteFeatureClusterSavingsByAnalysis(analysisId: string): Promise<void> {
    await db.delete(featureClusterSavings).where(eq(featureClusterSavings.savingsAnalysisId, analysisId));
  }

  // Calibration Data Operations
  async createCalibrationData(calibrationDataInput: InsertCalibrationData): Promise<CalibrationData> {
    const [calibration] = await db.insert(calibrationData).values(calibrationDataInput).returning();
    return calibration;
  }

  async getCalibrationData(calibrationId: string): Promise<CalibrationData | undefined> {
    const [calibration] = await db.select().from(calibrationData).where(eq(calibrationData.id, calibrationId));
    return calibration;
  }

  async getCalibrationDataByCategory(category: string, familyId?: string, projectType?: string): Promise<CalibrationData | undefined> {
    let query = db.select().from(calibrationData).where(
      and(
        eq(calibrationData.category, category),
        eq(calibrationData.isActive, true)
      )
    );
    
    if (familyId) {
      query = query.where(eq(calibrationData.familyId, familyId));
    }
    
    if (projectType) {
      query = query.where(eq(calibrationData.projectType, projectType));
    }
    
    const [calibration] = await query.orderBy(desc(calibrationData.lastUpdated)).limit(1);
    return calibration;
  }

  async getAllCalibrationData(familyId?: string): Promise<CalibrationData[]> {
    let query = db.select().from(calibrationData).where(eq(calibrationData.isActive, true));
    
    if (familyId) {
      query = query.where(eq(calibrationData.familyId, familyId));
    }
    
    return await query.orderBy(calibrationData.category);
  }

  async updateCalibrationData(calibrationId: string, updates: Partial<InsertCalibrationData>): Promise<CalibrationData> {
    const [updated] = await db
      .update(calibrationData)
      .set({ ...updates, lastUpdated: new Date() })
      .where(eq(calibrationData.id, calibrationId))
      .returning();
    return updated;
  }

  async deleteCalibrationData(calibrationId: string): Promise<void> {
    await db.delete(calibrationData).where(eq(calibrationData.id, calibrationId));
  }

  async upsertCalibrationData(calibrationDataInput: InsertCalibrationData): Promise<CalibrationData> {
    const existing = await this.getCalibrationDataByCategory(
      calibrationDataInput.category,
      calibrationDataInput.familyId || undefined,
      calibrationDataInput.projectType || undefined
    );
    
    if (existing) {
      return await this.updateCalibrationData(existing.id, calibrationDataInput);
    } else {
      return await this.createCalibrationData(calibrationDataInput);
    }
  }

  // Savings Recommendations Operations
  async createSavingsRecommendations(recommendationsData: InsertSavingsRecommendation[]): Promise<SavingsRecommendation[]> {
    return await db.insert(savingsRecommendations).values(recommendationsData).returning();
  }

  async getSavingsRecommendationsByAnalysis(analysisId: string): Promise<SavingsRecommendation[]> {
    return await db
      .select()
      .from(savingsRecommendations)
      .where(eq(savingsRecommendations.savingsAnalysisId, analysisId))
      .orderBy(savingsRecommendations.priority, desc(savingsRecommendations.expectedSavings));
  }

  async getSavingsRecommendationsByPriority(priority: string, familyId?: string): Promise<SavingsRecommendation[]> {
    let query = db
      .select()
      .from(savingsRecommendations)
      .innerJoin(savingsAnalyses, eq(savingsRecommendations.savingsAnalysisId, savingsAnalyses.id))
      .where(eq(savingsRecommendations.priority, priority))
      .orderBy(desc(savingsRecommendations.expectedSavings));
    
    if (familyId) {
      query = query.where(eq(savingsAnalyses.familyId, familyId));
    }
    
    const results = await query;
    return results.map(result => result.savings_recommendations);
  }

  async updateSavingsRecommendationStatus(
    recommendationId: string, 
    status: string, 
    actualImpact?: { savings?: number; efficiency?: number }
  ): Promise<SavingsRecommendation> {
    const updates: any = { status, updatedAt: new Date() };
    
    if (status === 'completed' && actualImpact) {
      updates.implementedAt = new Date();
      if (actualImpact.savings) updates.actualSavings = Math.round(actualImpact.savings * 100);
      if (actualImpact.efficiency) updates.actualEfficiency = actualImpact.efficiency;
    }
    
    const [updated] = await db
      .update(savingsRecommendations)
      .set(updates)
      .where(eq(savingsRecommendations.id, recommendationId))
      .returning();
    return updated;
  }

  async deleteSavingsRecommendationsByAnalysis(analysisId: string): Promise<void> {
    await db.delete(savingsRecommendations).where(eq(savingsRecommendations.savingsAnalysisId, analysisId));
  }

  // Savings Analytics and Reporting - simplified implementations for now
  async getSavingsTrends(familyId?: string, months = 6): Promise<{
    totalSavings: number;
    savingsOverTime: Array<{ period: string; savings: number; efficiency: number }>;
    topCategories: Array<{ category: string; totalSavings: number; averageEfficiency: number }>;
    recommendations: { implemented: number; pending: number; totalPotentialSavings: number };
  }> {
    // Simplified implementation - would need more complex aggregations for production
    const analyses = familyId 
      ? await this.getSavingsAnalysesByFamily(familyId, 50)
      : await db.select().from(savingsAnalyses).orderBy(desc(savingsAnalyses.calculatedAt)).limit(50);
    
    const totalSavings = analyses.reduce((sum, analysis) => sum + analysis.savingsDollars, 0) / 100;
    
    return {
      totalSavings,
      savingsOverTime: [],
      topCategories: [],
      recommendations: { implemented: 0, pending: 0, totalPotentialSavings: 0 }
    };
  }

  async getSavingsMetrics(familyId?: string): Promise<{
    totalAnalyses: number;
    totalSavings: number;
    averageEfficiency: number;
    bestPerformingCategory: string;
    worstPerformingCategory: string;
    lastAnalysisDate: Date | null;
    calibrationAccuracy: number;
  }> {
    const analyses = familyId 
      ? await this.getSavingsAnalysesByFamily(familyId, 100)
      : await db.select().from(savingsAnalyses).orderBy(desc(savingsAnalyses.calculatedAt)).limit(100);
    
    if (analyses.length === 0) {
      return {
        totalAnalyses: 0,
        totalSavings: 0,
        averageEfficiency: 0,
        bestPerformingCategory: 'N/A',
        worstPerformingCategory: 'N/A',
        lastAnalysisDate: null,
        calibrationAccuracy: 0
      };
    }
    
    const totalSavings = analyses.reduce((sum, analysis) => sum + analysis.savingsDollars, 0) / 100;
    const averageEfficiency = analyses.reduce((sum, analysis) => sum + analysis.costEfficiency, 0) / analyses.length / 100;
    const lastAnalysisDate = new Date(Math.max(...analyses.map(a => new Date(a.calculatedAt).getTime())));
    
    return {
      totalAnalyses: analyses.length,
      totalSavings,
      averageEfficiency,
      bestPerformingCategory: 'feature',
      worstPerformingCategory: 'bugfix',
      lastAnalysisDate,
      calibrationAccuracy: 85
    };
  }

  async compareSavingsAnalyses(analysisIds: string[]): Promise<{
    analyses: SavingsAnalysis[];
    comparison: {
      totalSavingsComparison: Array<{ analysisId: string; savings: number; percentage: number }>;
      categoryComparison: Record<string, Array<{ analysisId: string; savings: number }>>;
      efficiencyTrends: Array<{ analysisId: string; efficiency: number; date: string }>;
      recommendationSuccess: Array<{ analysisId: string; implementedCount: number; successRate: number }>;
    };
  }> {
    const analyses = await db
      .select()
      .from(savingsAnalyses)
      .where(inArray(savingsAnalyses.id, analysisIds))
      .orderBy(desc(savingsAnalyses.calculatedAt));
    
    const totalSavingsComparison = analyses.map(analysis => ({
      analysisId: analysis.id,
      savings: analysis.savingsDollars / 100,
      percentage: analysis.savingsPercentage / 100
    }));
    
    const efficiencyTrends = analyses.map(analysis => ({
      analysisId: analysis.id,
      efficiency: analysis.costEfficiency / 100,
      date: analysis.calculatedAt.toISOString()
    }));
    
    return {
      analyses,
      comparison: {
        totalSavingsComparison,
        categoryComparison: {},
        efficiencyTrends,
        recommendationSuccess: []
      }
    };
  }
}

export const storage = new DatabaseStorage();
