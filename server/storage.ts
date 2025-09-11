import {
  users,
  families,
  tasks,
  familyTasks,
  documents,
  messages,
  invitations,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, lt } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Family operations
  createFamily(family: InsertFamily): Promise<Family>;
  getFamilyByCode(familyCode: string): Promise<Family | undefined>;
  getAllFamilies(): Promise<Family[]>;
  getFamilyWithMembers(familyId: string): Promise<(Family & { members: User[] }) | undefined>;
  
  // Task operations
  createTask(task: InsertTask): Promise<Task>;
  getAllTasks(): Promise<Task[]>;
  initializeFamilyTasks(familyId: string): Promise<void>;
  getFamilyTasks(familyId: string): Promise<(FamilyTask & { task: Task })[]>;
  getFamilyTask(familyTaskId: string): Promise<FamilyTask | undefined>;
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
        target: users.id,
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

  async getFamilyTask(familyTaskId: string): Promise<FamilyTask | undefined> {
    const [task] = await db
      .select()
      .from(familyTasks)
      .where(eq(familyTasks.id, familyTaskId));
    return task;
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
}

export const storage = new DatabaseStorage();
