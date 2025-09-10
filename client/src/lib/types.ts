import type { User, Family, Task, FamilyTask, Document, Message } from "@shared/schema";

export interface UserWithFamily extends User {
  family?: FamilyWithMembers | null;
}

export interface FamilyWithMembers extends Family {
  members: User[];
}

export interface FamilyTaskWithTask extends FamilyTask {
  task: Task;
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