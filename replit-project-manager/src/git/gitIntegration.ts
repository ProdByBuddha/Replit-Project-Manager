import simpleGit, { SimpleGit, LogResult } from 'simple-git';
import { SavingsCalculator, SavingsCalculation, ExecutiveSummary, FeatureClusterSavings } from '../estimation/savingsCalculator.js';
import { ProjectParameters } from '../estimation/benchmarks.js';
import { GitAnalysisConfigSchema, sanitizeGitSinceDate } from '../validation.js';
import { GitCommit, CommitCategory, FileStats, TopContributor, GitAnalysisResult, GitAnalysisConfig } from '../types.js';
import fs from 'fs/promises';
import path from 'path';

interface CategoryMapping {
  name: string;
  commits: GitCommit[];
  keywords: string[];
}

export class GitIntegratedProgressService {
  private static instance: GitIntegratedProgressService;
  private savingsCalculator: SavingsCalculator;
  private savingsInitialized: boolean = false;
  private git: SimpleGit;

  private constructor() {
    this.savingsCalculator = SavingsCalculator.getInstance();
    this.git = simpleGit();
  }

  public static getInstance(): GitIntegratedProgressService {
    if (!GitIntegratedProgressService.instance) {
      GitIntegratedProgressService.instance = new GitIntegratedProgressService();
    }
    return GitIntegratedProgressService.instance;
  }

  /**
   * Initialize savings calculator if needed
   */
  private async initializeSavingsCalculator(): Promise<void> {
    if (!this.savingsInitialized) {
      try {
        console.log('[GitProgress] Savings calculator initialized successfully');
        await this.savingsCalculator.initialize();
        this.savingsInitialized = true;
      } catch (error) {
        console.error('[GitProgress] Failed to initialize savings calculator:', error);
        this.savingsInitialized = false;
      }
    }
  }

  /**
   * Analyze git history and categorize commits by functionality
   */
  public async analyzeGitHistory(sinceDate: string = '1 month ago', config: GitAnalysisConfig = {}): Promise<GitAnalysisResult> {
    try {
      console.log('[GitProgress] Analyzing git history...');
      
      // Sanitize input
      const safeSinceDate = sanitizeGitSinceDate(sinceDate);
      const validatedConfig = GitAnalysisConfigSchema.parse({ ...config, sinceDate: safeSinceDate });
      
      // Get commit history using simple-git
      const logResult = await this.git.log({ 
        from: undefined,
        to: undefined,
        maxCount: undefined,
        format: {
          hash: '%H',
          author_name: '%an',
          date: '%ai',
          message: '%s'
        }
      });

      // Filter commits by date
      const sinceTimestamp = new Date(Date.now() - this.parseDateToMs(safeSinceDate));
      const filteredCommits = logResult.all.filter(commit => {
        const commitDate = new Date(commit.date);
        return commitDate >= sinceTimestamp;
      });

      // Convert to our GitCommit format
      const commits: GitCommit[] = filteredCommits.map(commit => ({
        hash: commit.hash,
        author: commit.author_name,
        date: commit.date,
        message: commit.message,
        filesChanged: 1, // Default, could be enhanced with file stats
        linesAdded: 0,
        linesDeleted: 0
      }));

      // Get file statistics
      const fileStats = await this.getFileStatistics(safeSinceDate);

      // Categorize commits
      const categories = await this.categorizeCommits(commits);

      // Calculate top contributors
      const contributorMap = new Map<string, number>();
      commits.forEach(commit => {
        contributorMap.set(commit.author, (contributorMap.get(commit.author) || 0) + 1);
      });
      
      const topContributors = Array.from(contributorMap.entries())
        .map(([author, commits]) => ({ author, commits }))
        .sort((a, b) => b.commits - a.commits)
        .slice(0, 5);

      // Calculate date range
      const dates = commits.map(c => c.date).filter(Boolean);
      const dateRange = dates.length > 0 
        ? `${dates[dates.length - 1]} to ${dates[0]}`
        : 'No commits found';

      let result: GitAnalysisResult = {
        totalCommits: commits.length,
        dateRange,
        categories,
        topContributors,
        fileStats
      };

      // Add savings analysis if enabled
      if (validatedConfig.enableSavings && commits.length > 0) {
        try {
          await this.initializeSavingsCalculator();
          console.log('[GitProgress] Calculating project savings...');
          
          // Convert commits to CommitAnalysis format for savings calculation
          const commitAnalyses = commits.map(commit => ({
            hash: commit.hash,
            author: commit.author,
            date: commit.date,
            message: commit.message,
            filesChanged: commit.filesChanged || 1,
            linesAdded: commit.linesAdded || 0,
            linesDeleted: commit.linesDeleted || 0,
            category: this.categorizeCommitMessage(commit.message),
            complexity: 'medium' as any
          }));

          const savingsResult = await this.savingsCalculator.calculateProjectSavings({
            commits: commitAnalyses,
            sinceDate: safeSinceDate,
            projectType: validatedConfig.projectParameters?.projectType || 'webApplication',
            region: validatedConfig.projectParameters?.region || 'northAmerica',
            teamSize: validatedConfig.projectParameters?.teamSize || 5,
            confidenceThreshold: validatedConfig.confidenceThreshold || 70
          });

          if (savingsResult.confidence.overall >= (validatedConfig.confidenceThreshold || 70)) {
            result.savings = {
              calculation: savingsResult.calculation,
              summary: savingsResult.executiveSummary,
              topFeatures: savingsResult.featureClusterSavings,
              confidence: savingsResult.confidence.overall,
              calculationSucceeded: true
            };
          } else {
            result.savings = {
              calculation: {} as any,
              summary: {} as any,
              topFeatures: [],
              confidence: savingsResult.confidence.overall,
              calculationSucceeded: false,
              errorMessage: `Confidence ${Math.round(savingsResult.confidence.overall)}% below threshold ${validatedConfig.confidenceThreshold}%`
            };
          }
        } catch (error) {
          console.error('[GitProgress] Savings calculation failed:', error);
          result.savings = {
            calculation: {} as any,
            summary: {} as any,
            topFeatures: [],
            confidence: 0,
            calculationSucceeded: false,
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }

      return result;

    } catch (error) {
      console.error('[GitProgress] Error analyzing git history:', error);
      throw error;
    }
  }

  /**
   * Get file change statistics from git
   */
  private async getFileStatistics(sinceDate: string): Promise<FileStats> {
    try {
      // Use simple-git to get diff stats
      const diffSummary = await this.git.diffSummary(['HEAD~100', 'HEAD']);
      
      return {
        filesChanged: diffSummary.files.length,
        additions: diffSummary.insertions,
        deletions: diffSummary.deletions
      };
    } catch (error) {
      console.warn('[GitProgress] Could not get file statistics:', error);
      return { additions: 0, deletions: 0, filesChanged: 0 };
    }
  }

  /**
   * Categorize commits by functionality based on commit messages
   */
  private async categorizeCommits(commits: GitCommit[]): Promise<CategoryMapping[]> {
    const categories: CategoryMapping[] = [
      {
        name: 'Dart AI Integration & Project Management',
        keywords: ['dart', 'ai integration', 'progress report', 'task synchronization', 'project management'],
        commits: []
      },
      {
        name: 'Document Management & File Uploads',
        keywords: ['document', 'upload', 'file', 'attachment', 'storage', 'document center'],
        commits: []
      },
      {
        name: 'Real-Time Communication & Chat',
        keywords: ['chat', 'messaging', 'real-time', 'communication', 'typing indicator', 'socket'],
        commits: []
      },
      {
        name: 'Role-Based Access Control (RBAC)',
        keywords: ['rbac', 'role', 'permission', 'access control', 'user management', 'authorization'],
        commits: []
      },
      {
        name: 'Legal Research & AI Assistant',
        keywords: ['legal', 'ucc', 'uniform commercial code', 'us code', 'ai assistant', 'legal research'],
        commits: []
      },
      {
        name: 'User Interface & Experience',
        keywords: ['ui', 'ux', 'responsive', 'layout', 'mobile', 'design', 'interface', 'appearance'],
        commits: []
      },
      {
        name: 'Authentication & Security',
        keywords: ['auth', 'security', 'login', 'session', 'validation', 'authentication'],
        commits: []
      },
      {
        name: 'System Configuration & Settings',
        keywords: ['settings', 'configuration', 'system', 'admin', 'management', 'setup'],
        commits: []
      },
      {
        name: 'Data Management & Database',
        keywords: ['database', 'data', 'migration', 'schema', 'initialization', 'duplicate'],
        commits: []
      },
      {
        name: 'Notifications & Email',
        keywords: ['notification', 'email', 'alert', 'preferences', 'delivery'],
        commits: []
      }
    ];

    // Categorize each commit
    commits.forEach(commit => {
      const message = commit.message.toLowerCase();
      let categorized = false;

      for (const category of categories) {
        if (category.keywords.some(keyword => message.includes(keyword.toLowerCase()))) {
          category.commits.push(commit);
          categorized = true;
          break;
        }
      }

      // If not categorized, add to a miscellaneous category
      if (!categorized) {
        let miscCategory = categories.find(c => c.name === 'General Improvements');
        if (!miscCategory) {
          miscCategory = {
            name: 'General Improvements',
            keywords: [],
            commits: []
          };
          categories.push(miscCategory);
        }
        miscCategory.commits.push(commit);
      }
    });

    // Filter out empty categories
    return categories.filter(category => category.commits.length > 0);
  }

  /**
   * Categorize a single commit message
   */
  private categorizeCommitMessage(message: string): any {
    const lowerMessage = message.toLowerCase();
    
    const categoryKeywords = {
      feature: ['add', 'implement', 'create', 'new', 'feature', 'introduce'],
      bugfix: ['fix', 'bug', 'issue', 'resolve', 'correct', 'patch'],
      refactor: ['refactor', 'restructure', 'reorganize', 'cleanup', 'improve'],
      documentation: ['doc', 'readme', 'comment', 'documentation'],
      test: ['test', 'spec', 'testing', 'unit test', 'integration test'],
      maintenance: ['update', 'upgrade', 'dependency', 'version', 'merge'],
      infrastructure: ['deploy', 'config', 'build', 'ci', 'docker'],
      security: ['security', 'auth', 'permission', 'vulnerability'],
      performance: ['performance', 'optimize', 'cache', 'speed'],
      ui: ['ui', 'style', 'css', 'design', 'layout', 'responsive']
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => lowerMessage.includes(keyword))) {
        return category;
      }
    }

    return 'maintenance'; // default
  }

  /**
   * Parse date string to milliseconds
   */
  private parseDateToMs(dateStr: string): number {
    const match = dateStr.match(/^(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/);
    if (match) {
      const [, amount, unit] = match;
      const multipliers: Record<string, number> = {
        second: 1000,
        minute: 60 * 1000,
        hour: 60 * 60 * 1000,
        day: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000,
        year: 365 * 24 * 60 * 60 * 1000
      };
      return parseInt(amount) * (multipliers[unit] || multipliers.day);
    }
    
    // Default to 30 days
    return 30 * 24 * 60 * 60 * 1000;
  }

  /**
   * Get git repository status
   */
  public async getGitStatus(): Promise<string> {
    try {
      const status = await this.git.status();
      if (status.files.length === 0) {
        return 'Working directory clean';
      }
      return status.files.map(file => `${file.index}${file.working_tree} ${file.path}`).join('\n');
    } catch (error) {
      return 'Could not determine git status';
    }
  }

  /**
   * Get current branch information
   */
  public async getCurrentBranch(): Promise<string> {
    try {
      const status = await this.git.status();
      return status.current || 'Unknown branch';
    } catch (error) {
      return 'Unknown branch';
    }
  }
}