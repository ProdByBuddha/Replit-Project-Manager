import type { User, Family, Task, FamilyTask, Document, Message, TaskDependency, WorkflowRule } from "@shared/schema";
import type { UserRole, Permission } from "@shared/permissions";

export interface UserWithFamily extends User {
  family?: FamilyWithMembers | null;
  permissions?: Permission[];
  enabledFeatures?: ReturnType<typeof import("@shared/permissions").getEnabledFeatures>;
}

export interface FamilyWithMembers extends Family {
  members: User[];
}

export interface FamilyTaskWithTask extends FamilyTask {
  task: Task;
}

export interface TaskDependencyStatus {
  canStart: boolean;
  canComplete: boolean;
  blockedBy: string[];
  dependsOn: string[];
}

export interface FamilyTaskWithTaskAndDependencies extends FamilyTaskWithTask {
  dependencies: (TaskDependency & { dependsOnTask: Task })[];
  dependencyStatus: TaskDependencyStatus;
}

export interface DocumentWithUploader extends Document {
  uploader: User;
}

export interface MessageWithUser extends Message {
  fromUser: User;
}

export interface FamilyWithStats extends Family {
  stats: {
    completed: number;
    pending: number;
    documents: number;
    progress: number;
  };
}

export interface AdminStats {
  totalFamilies: number;
  completedCases: number;
  pendingReviews: number;
  totalDocuments: number;
}

export interface FamilyStats {
  completed: number;
  pending: number;
  documents: number;
  progress: number;
}

// Ministry Legitimization types
export interface MinistryChecklistSection {
  id: string;
  title: string;
  description: string;
  items: MinistryChecklistItem[];
}

export interface MinistryChecklistItem {
  id: string;
  title: string;
  description: string;
  purpose: string;
  whatItDoes: string[];
  howToUse: string[];
  whoSigns: string[];
  whereToFile: string[];
  stepByStepInstructions: string[];
  draftingChecklist: string[];
  practicalCautions?: string[];
  outputs: string[];
  category: 'foundational' | 'governance' | 'operations' | 'banking' | 'digital' | 'assets' | 'optional';
  priority: 'high' | 'medium' | 'low';
  estimatedTime: string;
  requiredDocuments: string[];
  isOptional: boolean;
  dependsOn?: string[]; // IDs of other items this depends on
  status: 'not_started' | 'in_progress' | 'completed' | 'not_applicable';
  completedAt?: Date;
  assignedTo?: string;
  notes?: string;
  uploadedDocuments?: Document[];
}

export interface MinistryProgress {
  totalItems: number;
  completedItems: number;
  inProgressItems: number;
  notStartedItems: number;
  notApplicableItems: number;
  overallProgress: number;
  categoryProgress: {
    [category: string]: {
      total: number;
      completed: number;
      progress: number;
    };
  };
}

// Admin interface types
export interface TaskDependencyWithNames extends TaskDependency {
  taskName: string;
  dependsOnTaskName: string;
}

export interface WorkflowRuleWithNames extends WorkflowRule {
  triggerTaskName?: string;
  actionTargetTaskName?: string;
}