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

/**
 * Replit Agent Metrics
 * Metrics tracked by Replit Agent at each checkpoint/commit
 */
export interface ReplitAgentMetrics {
  timeWorked?: number;        // Time in minutes
  workDone?: number;          // Number of actions performed
  itemsRead?: number;         // Lines of code read
  codeAdded?: number;         // Lines added
  codeDeleted?: number;       // Lines deleted
  agentUsage?: number;        // Cost in dollars
  checkpoint?: string;        // Checkpoint identifier
  timestamp?: string;         // When metrics were captured
}

/**
 * Enhanced commit with agent metrics
 */
export interface EnhancedCommit extends GitCommit {
  agentMetrics?: ReplitAgentMetrics;
  estimatedMetrics?: {
    timeWorked: number;      // Estimated based on complexity
    workDone: number;        // Estimated based on files changed
    itemsRead: number;       // Estimated based on context needed
    agentUsage: number;      // Estimated cost based on complexity
  };
}

export interface CommitCategory {
  name: string;
  commits: GitCommit[];
  keywords: string[];
  // Add aggregated agent metrics
  totalTimeWorked?: number;
  totalWorkDone?: number;
  totalItemsRead?: number;
  totalAgentUsage?: number;
}

export interface FileStats {
  additions: number;
  deletions: number;
  filesChanged: number;
}

export interface TopContributor {
  author: string;
  commits: number;
  timeWorked?: number;
  agentUsage?: number;
}

export interface ProgressUpdate {
  summary: string;
  added?: string[];
  fixed?: string[];
  improved?: string[];
  nextSteps?: string[];
  metadata?: Record<string, any>;
  savings?: SavingsData;
  // Add agent metrics summary
  agentMetrics?: {
    totalTimeWorked: number;
    totalWorkDone: number;
    totalItemsRead: number;
    totalCodeChanged: number;
    totalAgentUsage: number;
    averagePerCommit: {
      timeWorked: number;
      workDone: number;
      itemsRead: number;
      codeChanged: number;
      agentUsage: number;
    };
  };
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
  // Add agent metrics analysis
  agentMetrics?: {
    total: ReplitAgentMetrics;
    perCommit: ReplitAgentMetrics;
    perCategory: Record<string, ReplitAgentMetrics>;
    trend: {
      timeEfficiency: number;     // Trending up/down
      costEfficiency: number;      // Trending up/down
      productivityScore: number;   // Overall productivity
    };
  };
}

export interface GitAnalysisConfig {
  sinceDate?: string;
  enableSavings?: boolean;
  enableAgentMetrics?: boolean;
  confidenceThreshold?: number;
  projectParameters?: Record<string, any>;
  sendToDart?: boolean;
  // Agent metrics configuration
  agentMetricsSource?: 'estimated' | 'checkpoint' | 'both';
  includeHistoricalComparison?: boolean;
}

export interface RPMConfig {
  dartToken?: string;
  workspaceId?: string;
  dartboard?: string;
  reportsDir?: string;
  enableSavings?: boolean;
  enableAgentMetrics?: boolean;
  confidenceThreshold?: number;
  projectType?: string;
  region?: string;
}