import { sql, relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").notNull().default("family"), // 'family' or 'admin'
  familyId: varchar("family_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Families table
export const families = pgTable("families", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  familyCode: varchar("family_code").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tasks table - based on the PDF checklist items
export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description"),
  category: varchar("category").notNull(), // e.g., "paperwork", "applications", "documents"
  order: integer("order").notNull(),
  isTemplate: boolean("is_template").default(true), // if true, it's a template task
  createdAt: timestamp("created_at").defaultNow(),
});

// Family Tasks - instances of tasks for specific families
export const familyTasks = pgTable("family_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyId: varchar("family_id").notNull(),
  taskId: varchar("task_id").notNull(),
  status: varchar("status").notNull().default("not_started"), // 'not_started', 'in_progress', 'completed'
  assignedTo: varchar("assigned_to"), // user id
  notes: text("notes"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Documents table
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyId: varchar("family_id").notNull(),
  familyTaskId: varchar("family_task_id"), // optional, if document is related to specific task
  fileName: varchar("file_name").notNull(),
  originalFileName: varchar("original_file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: varchar("mime_type").notNull(),
  objectPath: varchar("object_path").notNull(), // path in object storage
  uploadedBy: varchar("uploaded_by").notNull(), // user id
  createdAt: timestamp("created_at").defaultNow(),
});

// Messages table - for admin-family communication
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyId: varchar("family_id").notNull(),
  fromUserId: varchar("from_user_id").notNull(),
  toRole: varchar("to_role").notNull(), // 'family' or 'admin'
  subject: varchar("subject").notNull(),
  content: text("content").notNull(),
  isRead: boolean("is_read").default(false),
  messageType: varchar("message_type").default("info"), // 'info', 'warning', 'success', 'error'
  createdAt: timestamp("created_at").defaultNow(),
});

// Invitations table - for inviting family members
export const invitations = pgTable("invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyId: varchar("family_id").notNull(),
  inviterUserId: varchar("inviter_user_id").notNull(),
  inviteeEmail: varchar("invitee_email").notNull(),
  invitationCode: varchar("invitation_code").notNull().unique(),
  status: varchar("status").notNull().default("pending"), // 'pending', 'accepted', 'declined', 'expired'
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  family: one(families, {
    fields: [users.familyId],
    references: [families.id],
  }),
  uploadedDocuments: many(documents),
  sentMessages: many(messages),
  assignedTasks: many(familyTasks),
  sentInvitations: many(invitations),
}));

export const familiesRelations = relations(families, ({ many }) => ({
  members: many(users),
  tasks: many(familyTasks),
  documents: many(documents),
  messages: many(messages),
  invitations: many(invitations),
}));

export const tasksRelations = relations(tasks, ({ many }) => ({
  familyTasks: many(familyTasks),
}));

export const familyTasksRelations = relations(familyTasks, ({ one, many }) => ({
  family: one(families, {
    fields: [familyTasks.familyId],
    references: [families.id],
  }),
  task: one(tasks, {
    fields: [familyTasks.taskId],
    references: [tasks.id],
  }),
  assignedUser: one(users, {
    fields: [familyTasks.assignedTo],
    references: [users.id],
  }),
  documents: many(documents),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  family: one(families, {
    fields: [documents.familyId],
    references: [families.id],
  }),
  familyTask: one(familyTasks, {
    fields: [documents.familyTaskId],
    references: [familyTasks.id],
  }),
  uploader: one(users, {
    fields: [documents.uploadedBy],
    references: [users.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  family: one(families, {
    fields: [messages.familyId],
    references: [families.id],
  }),
  fromUser: one(users, {
    fields: [messages.fromUserId],
    references: [users.id],
  }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  family: one(families, {
    fields: [invitations.familyId],
    references: [families.id],
  }),
  inviter: one(users, {
    fields: [invitations.inviterUserId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFamilySchema = createInsertSchema(families).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
});

export const insertFamilyTaskSchema = createInsertSchema(familyTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export const insertInvitationSchema = createInsertSchema(invitations).omit({
  id: true,
  createdAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Family = typeof families.$inferSelect;
export type InsertFamily = z.infer<typeof insertFamilySchema>;
export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type FamilyTask = typeof familyTasks.$inferSelect;
export type InsertFamilyTask = z.infer<typeof insertFamilyTaskSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Invitation = typeof invitations.$inferSelect;
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
