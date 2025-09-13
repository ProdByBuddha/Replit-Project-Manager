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
    phone: varchar("phone"),
    emailNotifications: boolean("email_notifications").default(true),
    darkMode: boolean("dark_mode").default(false),
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

// ===== US CODE INDEXING SYSTEM =====

// US Code Titles table - represents the 54 titles of the US Code
export const usCodeTitles = pgTable("us_code_titles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  number: integer("number").notNull().unique(), // Title number (1-54)
  name: varchar("name").notNull(),
  description: text("description"),
  packageId: varchar("package_id"), // GovInfo package ID
  lastModified: timestamp("last_modified"),
  lastIndexed: timestamp("last_indexed").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_us_code_titles_number").on(table.number),
  index("IDX_us_code_titles_last_modified").on(table.lastModified),
]);

// US Code Chapters table - represents chapters within titles
export const usCodeChapters = pgTable("us_code_chapters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  titleId: varchar("title_id").notNull(),
  number: varchar("number").notNull(), // Chapter number (can be numeric or alphanumeric)
  name: varchar("name").notNull(),
  description: text("description"),
  startSection: varchar("start_section"), // First section in chapter
  endSection: varchar("end_section"), // Last section in chapter
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.titleId], foreignColumns: [usCodeTitles.id] }),
  index("IDX_us_code_chapters_title").on(table.titleId),
  index("IDX_us_code_chapters_number").on(table.number),
  unique("UNQ_us_code_chapters_title_number").on(table.titleId, table.number),
]);

// US Code Sections table - individual code sections with full content
export const usCodeSections = pgTable("us_code_sections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  titleId: varchar("title_id").notNull(),
  chapterId: varchar("chapter_id"), // Optional - some sections may not have chapters
  number: varchar("number").notNull(), // Section number (e.g., "101", "1001", "3a")
  citation: varchar("citation").notNull().unique(), // Full citation (e.g., "15 USC 1001")
  heading: varchar("heading").notNull(),
  content: text("content").notNull(),
  xmlContent: text("xml_content"), // Original XML from GovInfo API
  contentVector: text("content_vector"), // Full-text search vector for PostgreSQL
  lastModified: timestamp("last_modified"),
  sourceUrl: varchar("source_url"),
  packageId: varchar("package_id"), // GovInfo package ID
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.titleId], foreignColumns: [usCodeTitles.id] }),
  foreignKey({ columns: [table.chapterId], foreignColumns: [usCodeChapters.id] }),
  index("IDX_us_code_sections_title").on(table.titleId),
  index("IDX_us_code_sections_chapter").on(table.chapterId),
  index("IDX_us_code_sections_number").on(table.number),
  index("IDX_us_code_sections_citation").on(table.citation),
  // Full-text search indexes using PostgreSQL's GIN (Generalized Inverted Index)
  // Note: tsvector indexes will be created after table creation via SQL triggers
  index("IDX_us_code_sections_content_text").on(table.content),
  index("IDX_us_code_sections_heading_text").on(table.heading),
  index("IDX_us_code_sections_last_modified").on(table.lastModified),
]);

// US Code Cross References table - tracks references between sections
export const usCodeCrossReferences = pgTable("us_code_cross_references", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromSectionId: varchar("from_section_id").notNull(),
  toSectionId: varchar("to_section_id").notNull(),
  referenceType: varchar("reference_type").notNull(), // 'citation', 'see_also', 'superseded', 'amended'
  context: text("context"), // Surrounding text where reference appears
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.fromSectionId], foreignColumns: [usCodeSections.id] }),
  foreignKey({ columns: [table.toSectionId], foreignColumns: [usCodeSections.id] }),
  index("IDX_us_code_cross_refs_from").on(table.fromSectionId),
  index("IDX_us_code_cross_refs_to").on(table.toSectionId),
  index("IDX_us_code_cross_refs_type").on(table.referenceType),
  unique("UNQ_us_code_cross_refs").on(table.fromSectionId, table.toSectionId, table.referenceType),
]);

// US Code Search Index table - optimized search index with metadata
export const usCodeSearchIndex = pgTable("us_code_search_index", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sectionId: varchar("section_id").notNull(),
  searchContent: text("search_content").notNull(), // Processed content for search
  keywords: varchar("keywords").array(), // Extracted legal keywords
  topics: varchar("topics").array(), // Legal topic classifications
  searchVector: text("search_vector"), // Optimized search vector
  popularity: integer("popularity").default(0), // Search frequency for ranking
  lastUpdated: timestamp("last_updated").defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.sectionId], foreignColumns: [usCodeSections.id] }),
  index("IDX_us_code_search_section").on(table.sectionId),
  index("IDX_us_code_search_content").on(table.searchContent),
  index("IDX_us_code_search_keywords").on(table.keywords),
  index("IDX_us_code_search_topics").on(table.topics),
  index("IDX_us_code_search_popularity").on(table.popularity),
]);

// US Code Indexing Jobs table - tracks indexing operations
export const usCodeIndexingJobs = pgTable("us_code_indexing_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobType: varchar("job_type").notNull(), // 'full_index', 'incremental', 'title_update', 'section_update'
  status: varchar("status").notNull().default("pending"), // 'pending', 'running', 'completed', 'failed'
  titleNumber: integer("title_number"), // Optional - for title-specific jobs
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
  progress: jsonb("progress"), // JSON object with progress details
  stats: jsonb("stats"), // Job statistics (sections processed, errors, etc.)
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_us_code_jobs_type").on(table.jobType),
  index("IDX_us_code_jobs_status").on(table.status),
  index("IDX_us_code_jobs_title").on(table.titleNumber),
  index("IDX_us_code_jobs_created").on(table.createdAt),
]);

// ===== UCC (UNIFORM COMMERCIAL CODE) INDEXING SYSTEM =====

// UCC Articles table - represents the 12 articles of the UCC (1, 2, 2A, 3, 4, 4A, 5, 6, 7, 8, 9, 12)
export const uccArticles = pgTable("ucc_articles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  number: varchar("number").notNull().unique(), // Article number (1, 2, 2A, 3, 4, 4A, 5, 6, 7, 8, 9, 12)
  name: varchar("name").notNull(),
  description: text("description"),
  officialTitle: varchar("official_title"), // Full official title from ALI/NCCUSL
  lastModified: timestamp("last_modified"),
  lastIndexed: timestamp("last_indexed").defaultNow(),
  sourceUrl: varchar("source_url"),
  packageId: varchar("package_id"), // Source package ID
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_ucc_articles_number").on(table.number),
  index("IDX_ucc_articles_last_modified").on(table.lastModified),
]);

// UCC Parts table - represents parts within articles where applicable
export const uccParts = pgTable("ucc_parts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  articleId: varchar("article_id").notNull(),
  number: varchar("number").notNull(), // Part number (can be numeric or alphanumeric)
  name: varchar("name").notNull(),
  description: text("description"),
  startSection: varchar("start_section"), // First section in part
  endSection: varchar("end_section"), // Last section in part
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.articleId], foreignColumns: [uccArticles.id] }),
  index("IDX_ucc_parts_article").on(table.articleId),
  index("IDX_ucc_parts_number").on(table.number),
  unique("UNQ_ucc_parts_article_number").on(table.articleId, table.number),
]);

// UCC Sections table - individual code sections with full content
export const uccSections = pgTable("ucc_sections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  articleId: varchar("article_id").notNull(),
  partId: varchar("part_id"), // Optional - some sections may not have parts
  number: varchar("number").notNull(), // Section number (e.g., "1-101", "2-103", "9-203")
  citation: varchar("citation").notNull().unique(), // Full citation (e.g., "UCC 1-101")
  officialComment: text("official_comment"), // Official ALI/NCCUSL comments
  heading: varchar("heading").notNull(),
  content: text("content").notNull(),
  xmlContent: text("xml_content"), // Original XML source
  contentVector: text("content_vector"), // Full-text search vector for PostgreSQL
  lastModified: timestamp("last_modified"),
  sourceUrl: varchar("source_url"),
  packageId: varchar("package_id"), // Source package ID
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.articleId], foreignColumns: [uccArticles.id] }),
  foreignKey({ columns: [table.partId], foreignColumns: [uccParts.id] }),
  index("IDX_ucc_sections_article").on(table.articleId),
  index("IDX_ucc_sections_part").on(table.partId),
  index("IDX_ucc_sections_number").on(table.number),
  index("IDX_ucc_sections_citation").on(table.citation),
  // Full-text search indexes using PostgreSQL's GIN (Generalized Inverted Index)
  index("IDX_ucc_sections_content_text").on(table.content),
  index("IDX_ucc_sections_heading_text").on(table.heading),
  index("IDX_ucc_sections_last_modified").on(table.lastModified),
]);

// UCC Subsections table - detailed subsections and paragraphs
export const uccSubsections = pgTable("ucc_subsections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sectionId: varchar("section_id").notNull(),
  number: varchar("number").notNull(), // Subsection number (e.g., "(a)", "(1)", "(i)")
  content: text("content").notNull(),
  level: integer("level").notNull().default(1), // Nesting level (1 for (a), 2 for (1), 3 for (i))
  parentSubsectionId: varchar("parent_subsection_id"), // For nested subsections
  order: integer("order").notNull(), // Order within parent section/subsection
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.sectionId], foreignColumns: [uccSections.id] }),
  foreignKey({ columns: [table.parentSubsectionId], foreignColumns: [uccSubsections.id] }),
  index("IDX_ucc_subsections_section").on(table.sectionId),
  index("IDX_ucc_subsections_parent").on(table.parentSubsectionId),
  index("IDX_ucc_subsections_level").on(table.level),
  index("IDX_ucc_subsections_order").on(table.order),
  unique("UNQ_ucc_subsections_section_number").on(table.sectionId, table.number),
]);

// UCC Cross References table - tracks references between UCC sections and external codes
export const uccCrossReferences = pgTable("ucc_cross_references", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromSectionId: varchar("from_section_id").notNull(),
  toSectionId: varchar("to_section_id"), // UCC section reference
  externalReference: varchar("external_reference"), // Non-UCC reference (e.g., "15 USC 1601")
  referenceType: varchar("reference_type").notNull(), // 'cross_reference', 'see_also', 'superseded', 'amended', 'external'
  context: text("context"), // Surrounding text where reference appears
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.fromSectionId], foreignColumns: [uccSections.id] }),
  foreignKey({ columns: [table.toSectionId], foreignColumns: [uccSections.id] }),
  index("IDX_ucc_cross_refs_from").on(table.fromSectionId),
  index("IDX_ucc_cross_refs_to").on(table.toSectionId),
  index("IDX_ucc_cross_refs_external").on(table.externalReference),
  index("IDX_ucc_cross_refs_type").on(table.referenceType),
  unique("UNQ_ucc_cross_refs").on(table.fromSectionId, table.toSectionId, table.externalReference, table.referenceType),
]);

// UCC Definitions table - key terms and definitions extracted from UCC sections
export const uccDefinitions = pgTable("ucc_definitions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  term: varchar("term").notNull(),
  definition: text("definition").notNull(),
  sectionId: varchar("section_id").notNull(), // Section where definition appears
  articleId: varchar("article_id").notNull(), // Article context
  scope: varchar("scope").notNull().default("section"), // 'section', 'article', 'general'
  alternativeTerms: varchar("alternative_terms").array(), // Synonyms and related terms
  citationContext: text("citation_context"), // Full citation with context
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.sectionId], foreignColumns: [uccSections.id] }),
  foreignKey({ columns: [table.articleId], foreignColumns: [uccArticles.id] }),
  index("IDX_ucc_definitions_term").on(table.term),
  index("IDX_ucc_definitions_section").on(table.sectionId),
  index("IDX_ucc_definitions_article").on(table.articleId),
  index("IDX_ucc_definitions_scope").on(table.scope),
  index("IDX_ucc_definitions_alternative_terms").on(table.alternativeTerms),
  unique("UNQ_ucc_definitions_term_section").on(table.term, table.sectionId),
]);

// UCC Search Index table - optimized search index with commercial law metadata
export const uccSearchIndex = pgTable("ucc_search_index", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sectionId: varchar("section_id").notNull(),
  searchContent: text("search_content").notNull(), // Processed content for search
  keywords: varchar("keywords").array(), // Extracted commercial law keywords
  topics: varchar("topics").array(), // Commercial law topic classifications
  commercialTerms: varchar("commercial_terms").array(), // UCC-specific commercial terms
  transactionTypes: varchar("transaction_types").array(), // Types of commercial transactions
  searchVector: text("search_vector"), // Optimized search vector
  popularity: integer("popularity").default(0), // Search frequency for ranking
  lastUpdated: timestamp("last_updated").defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.sectionId], foreignColumns: [uccSections.id] }),
  index("IDX_ucc_search_section").on(table.sectionId),
  index("IDX_ucc_search_content").on(table.searchContent),
  index("IDX_ucc_search_keywords").on(table.keywords),
  index("IDX_ucc_search_topics").on(table.topics),
  index("IDX_ucc_search_commercial_terms").on(table.commercialTerms),
  index("IDX_ucc_search_transaction_types").on(table.transactionTypes),
  index("IDX_ucc_search_popularity").on(table.popularity),
]);

// UCC Indexing Jobs table - tracks UCC indexing operations
export const uccIndexingJobs = pgTable("ucc_indexing_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobType: varchar("job_type").notNull(), // 'full_index', 'incremental', 'article_update', 'section_update', 'definitions_extract'
  status: varchar("status").notNull().default("pending"), // 'pending', 'running', 'completed', 'failed'
  articleNumber: varchar("article_number"), // Optional - for article-specific jobs
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
  progress: jsonb("progress"), // JSON object with progress details
  stats: jsonb("stats"), // Job statistics (sections processed, definitions extracted, etc.)
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_ucc_jobs_type").on(table.jobType),
  index("IDX_ucc_jobs_status").on(table.status),
  index("IDX_ucc_jobs_article").on(table.articleNumber),
  index("IDX_ucc_jobs_created").on(table.createdAt),
]);

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Profile update schema
export const updateProfileSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  emailNotifications: z.boolean(),
  darkMode: z.boolean(),
});

// Profile types
export type User = typeof users.$inferSelect;
export type ProfileUpdate = z.infer<typeof updateProfileSchema>;
export type ProfileResponse = User & {
  familyCode?: string;
};

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

// US Code insert schemas
export const insertUsCodeTitleSchema = createInsertSchema(usCodeTitles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUsCodeChapterSchema = createInsertSchema(usCodeChapters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUsCodeSectionSchema = createInsertSchema(usCodeSections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  contentVector: true, // Exclude search vector from insert schema
});

export const insertUsCodeCrossReferenceSchema = createInsertSchema(usCodeCrossReferences).omit({
  id: true,
  createdAt: true,
});

export const insertUsCodeSearchIndexSchema = createInsertSchema(usCodeSearchIndex).omit({
  id: true,
  searchVector: true, // Exclude search vector from insert schema
});

export const insertUsCodeIndexingJobSchema = createInsertSchema(usCodeIndexingJobs).omit({
  id: true,
  createdAt: true,
});

// UCC insert schemas
export const insertUccArticleSchema = createInsertSchema(uccArticles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUccPartSchema = createInsertSchema(uccParts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUccSectionSchema = createInsertSchema(uccSections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  contentVector: true, // Exclude search vector from insert schema
});

export const insertUccSubsectionSchema = createInsertSchema(uccSubsections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUccCrossReferenceSchema = createInsertSchema(uccCrossReferences).omit({
  id: true,
  createdAt: true,
});

export const insertUccDefinitionSchema = createInsertSchema(uccDefinitions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUccSearchIndexSchema = createInsertSchema(uccSearchIndex).omit({
  id: true,
  searchVector: true, // Exclude search vector from insert schema
});

export const insertUccIndexingJobSchema = createInsertSchema(uccIndexingJobs).omit({
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

// US Code types
export type UsCodeTitle = typeof usCodeTitles.$inferSelect;
export type InsertUsCodeTitle = z.infer<typeof insertUsCodeTitleSchema>;
export type UsCodeChapter = typeof usCodeChapters.$inferSelect;
export type InsertUsCodeChapter = z.infer<typeof insertUsCodeChapterSchema>;
export type UsCodeSection = typeof usCodeSections.$inferSelect;
export type InsertUsCodeSection = z.infer<typeof insertUsCodeSectionSchema>;
export type UsCodeCrossReference = typeof usCodeCrossReferences.$inferSelect;
export type InsertUsCodeCrossReference = z.infer<typeof insertUsCodeCrossReferenceSchema>;
export type UsCodeSearchIndex = typeof usCodeSearchIndex.$inferSelect;
export type InsertUsCodeSearchIndex = z.infer<typeof insertUsCodeSearchIndexSchema>;
export type UsCodeIndexingJob = typeof usCodeIndexingJobs.$inferSelect;
export type InsertUsCodeIndexingJob = z.infer<typeof insertUsCodeIndexingJobSchema>;

// UCC types
export type UccArticle = typeof uccArticles.$inferSelect;
export type InsertUccArticle = z.infer<typeof insertUccArticleSchema>;
export type UccPart = typeof uccParts.$inferSelect;
export type InsertUccPart = z.infer<typeof insertUccPartSchema>;
export type UccSection = typeof uccSections.$inferSelect;
export type InsertUccSection = z.infer<typeof insertUccSectionSchema>;
export type UccSubsection = typeof uccSubsections.$inferSelect;
export type InsertUccSubsection = z.infer<typeof insertUccSubsectionSchema>;
export type UccCrossReference = typeof uccCrossReferences.$inferSelect;
export type InsertUccCrossReference = z.infer<typeof insertUccCrossReferenceSchema>;
export type UccDefinition = typeof uccDefinitions.$inferSelect;
export type InsertUccDefinition = z.infer<typeof insertUccDefinitionSchema>;
export type UccSearchIndex = typeof uccSearchIndex.$inferSelect;
export type InsertUccSearchIndex = z.infer<typeof insertUccSearchIndexSchema>;
export type UccIndexingJob = typeof uccIndexingJobs.$inferSelect;
export type InsertUccIndexingJob = z.infer<typeof insertUccIndexingJobSchema>;
