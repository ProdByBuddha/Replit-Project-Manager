/**
 * Core type definitions for Replit Project Manager
 */

export interface GitCommit {
  hash: string;
  author: string;
  date: string;
  message: string;
  filesChanged?: number;
  linesAdded?: number;
  linesDeleted?: number;
}

export interface CommitCategory {
  name: string;
  commits: GitCommit[];
  keywords: string[];
}

export interface FileStats {
  additions: number;
  deletions: number;
  filesChanged: number;
}

export interface TopContributor {
  author: string;
  commits: number;
}

export interface ProgressUpdate {
  summary: string;
  added?: string[];
  fixed?: string[];
  improved?: string[];
  nextSteps?: string[];
  metadata?: Record<string, any>;
  savings?: SavingsData;
}

export interface SavingsData {
  calculation: any; // SavingsCalculation from estimation module
  summary: any; // ExecutiveSummary from estimation module
  topFeatures?: any[];
  confidence: number;
  calculationSucceeded: boolean;
  errorMessage?: string;
  period?: string;
}

export interface GitAnalysisResult {
  totalCommits: number;
  dateRange: string;
  categories: CommitCategory[];
  topContributors: TopContributor[];
  fileStats: FileStats;
  savings?: SavingsData;
}

export interface GitAnalysisConfig {
  sinceDate?: string;
  enableSavings?: boolean;
  confidenceThreshold?: number;
  projectParameters?: Record<string, any>;
  sendToDart?: boolean;
}

export interface RPMConfig {
  dartToken?: string;
  workspaceId?: string;
  dartboard?: string;
  reportsDir?: string;
  enableSavings?: boolean;
  confidenceThreshold?: number;
  projectType?: string;
  region?: string;
}