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
  unique,
  foreignKey,
  check,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User roles enum
export const userRoleEnum = pgEnum('user_role', [
  'family',
  'executor', 
  'elder',
  'legislator',
  'ministry_admin',
  'platform_admin'
]);

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
export const users = pgTable(
  "users",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    email: varchar("email").unique(),
    firstName: varchar("first_name"),
    lastName: varchar("last_name"),
    profileImageUrl: varchar("profile_image_url"),
    role: userRoleEnum("role").notNull().default("family"),
    familyId: varchar("family_id"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    // Foreign key constraint to ensure family exists
    foreignKey({ columns: [table.familyId], foreignColumns: [families.id] }),
  ]
);

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
export const familyTasks = pgTable(
  "family_tasks",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    familyId: varchar("family_id").notNull(),
    taskId: varchar("task_id").notNull(),
    status: varchar("status").notNull().default("not_started"), // 'not_started', 'in_progress', 'completed'
    assignedTo: varchar("assigned_to"), // user id
    notes: text("notes"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    // Foreign key constraints for referential integrity
    foreignKey({ columns: [table.familyId], foreignColumns: [families.id] }),
    foreignKey({ columns: [table.taskId], foreignColumns: [tasks.id] }),
    foreignKey({ columns: [table.assignedTo], foreignColumns: [users.id] }),
  ]
);

// Documents table
export const documents = pgTable(
  "documents",
  {
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
  },
  (table) => [
    // Foreign key constraints for referential integrity
    foreignKey({ columns: [table.familyId], foreignColumns: [families.id] }),
    foreignKey({ columns: [table.familyTaskId], foreignColumns: [familyTasks.id] }),
    foreignKey({ columns: [table.uploadedBy], foreignColumns: [users.id] }),
  ]
);

// Messages table - for admin-family communication
export const messages = pgTable(
  "messages",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    familyId: varchar("family_id").notNull(),
    fromUserId: varchar("from_user_id").notNull(),
    toRole: varchar("to_role").notNull(), // 'family' or 'admin'
    subject: varchar("subject").notNull(),
    content: text("content").notNull(),
    isRead: boolean("is_read").default(false),
    messageType: varchar("message_type").default("info"), // 'info', 'warning', 'success', 'error'
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    // Foreign key constraints for referential integrity
    foreignKey({ columns: [table.familyId], foreignColumns: [families.id] }),
    foreignKey({ columns: [table.fromUserId], foreignColumns: [users.id] }),
  ]
);

// Invitations table - for inviting family members
export const invitations = pgTable(
  "invitations",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    familyId: varchar("family_id").notNull(),
    inviterUserId: varchar("inviter_user_id").notNull(),
    inviteeEmail: varchar("invitee_email").notNull(),
    invitationCode: varchar("invitation_code").notNull().unique(),
    status: varchar("status").notNull().default("pending"), // 'pending', 'accepted', 'declined', 'expired'
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    // Foreign key constraints for referential integrity
    foreignKey({ columns: [table.familyId], foreignColumns: [families.id] }),
    foreignKey({ columns: [table.inviterUserId], foreignColumns: [users.id] }),
  ]
);

// Notification preferences table - for managing user email preferences
export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().unique(),
    emailOnTaskStatus: boolean("email_on_task_status").default(true),
    emailOnDocumentUpload: boolean("email_on_document_upload").default(true),
    emailOnAdminMessage: boolean("email_on_admin_message").default(true),
    emailOnInvitations: boolean("email_on_invitations").default(true),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    // Foreign key constraint for referential integrity
    foreignKey({ columns: [table.userId], foreignColumns: [users.id] }),
  ]
);

// Notification logs table - for tracking sent notifications and deduplication
export const notificationLogs = pgTable(
  "notification_logs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    type: varchar("type").notNull(), // 'task', 'document', 'message', 'invitation'
    recipientUserId: varchar("recipient_user_id"), // nullable - for registered users
    recipientEmail: varchar("recipient_email"), // for invitation notifications to emails
    familyId: varchar("family_id"), // nullable for admin notifications
    entityId: varchar("entity_id").notNull(), // id of the related entity (task, document, message, invitation)
    status: varchar("status").notNull(), // 'sent', 'failed'
    error: text("error"), // nullable error message if sending failed
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    // Foreign key constraints for referential integrity
    foreignKey({ columns: [table.recipientUserId], foreignColumns: [users.id] }),
    foreignKey({ columns: [table.familyId], foreignColumns: [families.id] }),
  ]
);

// Task Dependencies table - defines prerequisite relationships between template tasks
export const taskDependencies = pgTable(
  "task_dependencies",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    taskId: varchar("task_id").notNull(), // The task that has dependencies
    dependsOnTaskId: varchar("depends_on_task_id").notNull(), // The prerequisite task
    dependencyType: varchar("dependency_type").notNull().default("required"), // 'required', 'optional', 'sequential'
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("IDX_task_dependencies_task_id").on(table.taskId),
    index("IDX_task_dependencies_depends_on").on(table.dependsOnTaskId),
    index("IDX_task_dependencies_composite").on(table.taskId, table.dependsOnTaskId),
    // CRITICAL: Add uniqueness constraint to prevent duplicate dependencies
    unique("UNQ_task_dependencies_unique").on(table.taskId, table.dependsOnTaskId, table.dependencyType),
    // CRITICAL: Foreign key constraints for referential integrity
    foreignKey({ columns: [table.taskId], foreignColumns: [tasks.id] }),
    foreignKey({ columns: [table.dependsOnTaskId], foreignColumns: [tasks.id] }),
    // CRITICAL: CHECK constraint to prevent self-dependency
    check("CHK_no_self_dependency", sql`${table.taskId} != ${table.dependsOnTaskId}`),
  ]
);

// Workflow Rules table - automation rules for task management
export const workflowRules = pgTable(
  "workflow_rules",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name").notNull(),
    description: text("description"),
    triggerCondition: varchar("trigger_condition").notNull(), // 'task_completed', 'all_dependencies_met', 'status_change'
    // NORMALIZED TRIGGER COLUMNS (replaces polymorphic triggerValue)
    triggerTaskId: varchar("trigger_task_id"), // nullable, for task-based triggers
    triggerStatus: varchar("trigger_status"), // nullable, for status-based triggers
    action: varchar("action").notNull(), // 'auto_enable', 'auto_complete', 'send_notification', 'assign_user'
    // NORMALIZED ACTION TARGET COLUMNS (replaces polymorphic actionTarget)
    targetType: varchar("target_type").notNull(), // 'task' or 'user'
    actionTargetTaskId: varchar("action_target_task_id"), // nullable
    actionTargetUserId: varchar("action_target_user_id"), // nullable
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    // Performance-optimized indexes for common query patterns
    index("IDX_workflow_rules_trigger_composite").on(table.isActive, table.triggerCondition, table.triggerTaskId),
    index("IDX_workflow_rules_target_task").on(table.isActive, table.actionTargetTaskId),
    index("IDX_workflow_rules_target_user").on(table.isActive, table.targetType, table.actionTargetUserId),
    index("IDX_workflow_rules_active").on(table.isActive),
    // CRITICAL: Foreign key constraints for referential integrity
    foreignKey({ columns: [table.triggerTaskId], foreignColumns: [tasks.id] }),
    foreignKey({ columns: [table.actionTargetTaskId], foreignColumns: [tasks.id] }),
    foreignKey({ columns: [table.actionTargetUserId], foreignColumns: [users.id] }),
  ]
);

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
  notificationPreferences: one(notificationPreferences),
  notificationLogs: many(notificationLogs),
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
  dependencies: many(taskDependencies),
  dependentOn: many(taskDependencies, {
    relationName: "taskDependentOn",
  }),
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

export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
  user: one(users, {
    fields: [notificationPreferences.userId],
    references: [users.id],
  }),
}));

export const notificationLogsRelations = relations(notificationLogs, ({ one }) => ({
  recipient: one(users, {
    fields: [notificationLogs.recipientUserId],
    references: [users.id],
  }),
  family: one(families, {
    fields: [notificationLogs.familyId],
    references: [families.id],
  }),
}));

export const taskDependenciesRelations = relations(taskDependencies, ({ one }) => ({
  task: one(tasks, {
    fields: [taskDependencies.taskId],
    references: [tasks.id],
  }),
  dependsOnTask: one(tasks, {
    fields: [taskDependencies.dependsOnTaskId],
    references: [tasks.id],
    relationName: "taskDependentOn",
  }),
}));

export const workflowRulesRelations = relations(workflowRules, ({ one }) => ({
  // Fixed normalized relations (no more polymorphic issues)
  triggerTask: one(tasks, {
    fields: [workflowRules.triggerTaskId],
    references: [tasks.id],
  }),
  actionTargetTask: one(tasks, {
    fields: [workflowRules.actionTargetTaskId],
    references: [tasks.id],
  }),
  actionTargetUser: one(users, {
    fields: [workflowRules.actionTargetUserId],
    references: [users.id],
  }),
}));

// System Settings table - for platform-wide configuration
export const systemSettings = pgTable("system_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key").notNull().unique(),
  value: jsonb("value").notNull(),
  category: varchar("category").notNull(), // 'general', 'notifications', 'security', 'features', 'integrations'
  description: text("description"),
  isReadOnly: boolean("is_read_only").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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

export const insertNotificationPreferencesSchema = createInsertSchema(notificationPreferences).omit({
  id: true,
  updatedAt: true,
});

export const insertNotificationLogSchema = createInsertSchema(notificationLogs).omit({
  id: true,
  createdAt: true,
});

export const insertTaskDependencySchema = createInsertSchema(taskDependencies).omit({
  id: true,
  createdAt: true,
});

export const insertWorkflowRuleSchema = createInsertSchema(workflowRules).omit({
  id: true,
  createdAt: true,
});

export const insertSystemSettingsSchema = createInsertSchema(systemSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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
export type NotificationPreferences = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreferences = z.infer<typeof insertNotificationPreferencesSchema>;
export type NotificationLog = typeof notificationLogs.$inferSelect;
export type InsertNotificationLog = z.infer<typeof insertNotificationLogSchema>;
export type TaskDependency = typeof taskDependencies.$inferSelect;
export type InsertTaskDependency = z.infer<typeof insertTaskDependencySchema>;
export type WorkflowRule = typeof workflowRules.$inferSelect;
export type InsertWorkflowRule = z.infer<typeof insertWorkflowRuleSchema>;
export type SystemSettings = typeof systemSettings.$inferSelect;
export type InsertSystemSettings = z.infer<typeof insertSystemSettingsSchema>;
