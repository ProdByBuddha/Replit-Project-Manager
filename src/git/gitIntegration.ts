import simpleGit, { SimpleGit, LogResult } from 'simple-git';
import { SavingsCalculator, SavingsCalculation, ExecutiveSummary, FeatureClusterSavings } from '../estimation/savingsCalculator.js';
import { ProjectParameters } from '../estimation/benchmarks.js';
import { GitAnalysisConfigSchema, sanitizeGitSinceDate } from '../validation.js';
import { GitCommit, CommitCategory, FileStats, TopContributor, GitAnalysisResult, GitAnalysisConfig, EnhancedCommit, ReplitAgentMetrics } from '../types.js';
import { AgentMetricsService } from '../metrics/agentMetrics.js';
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
  private agentMetricsService: AgentMetricsService;
  private savingsInitialized: boolean = false;
  private git: SimpleGit;

  private constructor() {
    this.savingsCalculator = SavingsCalculator.getInstance();
    this.agentMetricsService = AgentMetricsService.getInstance();
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
        filesChanged: 0, // Will be calculated if needed
        linesAdded: 0,   // Will be calculated if needed
        linesDeleted: 0  // Will be calculated if needed
      }));

      // Get file stats
      const fileStats = await this.calculateFileStats(commits);

      // Categorize commits
      const categories = await this.categorizeCommits(commits);

      // Enhance commits with agent metrics if enabled
      let enhancedCommits: EnhancedCommit[] = commits;
      if (validatedConfig.enableAgentMetrics !== false) {
        enhancedCommits = await this.agentMetricsService.enhanceCommitsWithMetrics(commits);
      }

      // Calculate top contributors with agent metrics
      const contributorMap = new Map<string, { commits: number; timeWorked: number; agentUsage: number }>();
      enhancedCommits.forEach(commit => {
        const existing = contributorMap.get(commit.author) || { commits: 0, timeWorked: 0, agentUsage: 0 };
        const metrics = commit.estimatedMetrics || commit.agentMetrics;
        contributorMap.set(commit.author, {
          commits: existing.commits + 1,
          timeWorked: existing.timeWorked + (metrics?.timeWorked || 0),
          agentUsage: existing.agentUsage + (metrics?.agentUsage || 0)
        });
      });
      
      const topContributors = Array.from(contributorMap.entries())
        .map(([author, data]) => ({ 
          author, 
          commits: data.commits,
          timeWorked: data.timeWorked,
          agentUsage: Math.round(data.agentUsage * 100) / 100
        }))
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

      // Add agent metrics analysis if enabled
      if (validatedConfig.enableAgentMetrics !== false && enhancedCommits.length > 0) {
        const totalMetrics = this.agentMetricsService.calculateAggregateMetrics(enhancedCommits);
        const avgMetrics = this.agentMetricsService.calculateAverageMetrics(enhancedCommits);
        const trends = this.agentMetricsService.calculateProductivityTrends(enhancedCommits);
        
        // Calculate per-category metrics
        const perCategoryMetrics: Record<string, ReplitAgentMetrics> = {};
        for (const category of categories) {
          const categoryCommits = enhancedCommits.filter(c => 
            category.commits.some(cc => cc.hash === c.hash)
          );
          if (categoryCommits.length > 0) {
            perCategoryMetrics[category.name] = this.agentMetricsService.calculateAggregateMetrics(categoryCommits);
          }
        }

        result.agentMetrics = {
          total: totalMetrics,
          perCommit: avgMetrics,
          perCategory: perCategoryMetrics,
          trend: trends
        };
      }

      // Add savings analysis if enabled
      if (validatedConfig.enableSavings && commits.length > 0) {
        try {
          await this.initializeSavingsCalculator();
          console.log('[GitProgress] Calculating project savings...');
          
          const savingsResult = await this.savingsCalculator.calculateSavingsFromGitHistory(
            commits,
            validatedConfig.projectParameters
          );
          
          if (savingsResult.calculationSucceeded) {
            result.savings = {
              calculation: savingsResult.calculation,
              summary: savingsResult.summary,
              topFeatures: savingsResult.topFeatures,
              confidence: savingsResult.confidence,
              calculationSucceeded: true,
              period: safeSinceDate
            };
          } else {
            result.savings = {
              calculation: savingsResult.calculation,
              summary: savingsResult.summary,
              confidence: savingsResult.confidence,
              calculationSucceeded: false,
              errorMessage: savingsResult.errorMessage,
              period: safeSinceDate
            };
          }
        } catch (error) {
          console.error('[GitProgress] Failed to calculate savings:', error);
        }
      }

      // Save the analysis results if requested
      if (config.sendToDart) {
        await this.saveAnalysisResults(result);
      }

      return result;
    } catch (error) {
      console.error('[GitProgress] Error analyzing git history:', error);
      throw error;
    }
  }

  /**
   * Save analysis results to files for easy access
   */
  private async saveAnalysisResults(analysis: GitAnalysisResult): Promise<void> {
    try {
      const reportsDir = path.join(process.cwd(), '.dart-reports');
      await fs.mkdir(reportsDir, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      // Save full git analysis
      const analysisPath = path.join(reportsDir, `git-analysis-${timestamp}.json`);
      const analysisReport = {
        timestamp: new Date().toISOString(),
        analysis,
        metadata: {
          generatedBy: 'GitIntegratedProgressService',
          version: '2.0.0',
          includesSavingsAnalysis: !!analysis.savings,
          includesAgentMetrics: !!analysis.agentMetrics,
          savingsConfidence: analysis.savings?.confidence || 0,
          savingsCalculationSucceeded: analysis.savings?.calculationSucceeded || false
        }
      };
      
      await fs.writeFile(analysisPath, JSON.stringify(analysisReport, null, 2));
      console.log(`[GitProgress] Analysis saved to ${analysisPath}`);
      
      // Save as last-git-analysis.json for easy access
      const lastAnalysisPath = path.join(reportsDir, 'last-git-analysis.json');
      await fs.writeFile(lastAnalysisPath, JSON.stringify(analysisReport, null, 2));
      console.log(`[GitProgress] Latest analysis saved to ${lastAnalysisPath}`);
      
      // Save savings summary if available
      if (analysis.savings?.calculationSucceeded && analysis.savings?.summary) {
        const savingsPath = path.join(reportsDir, `savings-summary-${timestamp}.json`);
        const savingsSummary = {
          timestamp: new Date().toISOString(),
          dateRange: analysis.dateRange,
          totalSavings: {
            dollars: Math.round(analysis.savings.calculation?.savings?.dollars || 0),
            hours: Math.round(analysis.savings.calculation?.savings?.hours || 0),
            weeks: Math.round(analysis.savings.calculation?.savings?.weeks || 0),
            percentage: Math.round(analysis.savings.calculation?.savings?.percentage || 0)
          },
          topOpportunities: analysis.savings.summary?.topOpportunities?.slice(0, 5) || [],
          efficiency: {
            productivityMultiplier: analysis.savings.summary?.efficiency?.productivityMultiplier || 1,
            costEfficiency: analysis.savings.summary?.efficiency?.costEfficiency || 0
          },
          confidence: analysis.savings.confidence || 0
        };
        
        await fs.writeFile(savingsPath, JSON.stringify(savingsSummary, null, 2));
        console.log(`[GitProgress] Savings summary saved to ${savingsPath}`);
        
        // Save as last-savings-summary.json for easy access
        const lastSavingsPath = path.join(reportsDir, 'last-savings-summary.json');
        await fs.writeFile(lastSavingsPath, JSON.stringify(savingsSummary, null, 2));
        console.log(`[GitProgress] Latest savings summary saved to ${lastSavingsPath}`);
      }
    } catch (error) {
      console.error('[GitProgress] Failed to save analysis results:', error);
    }
  }

  /**
   * Parse date string to milliseconds
   */
  private parseDateToMs(dateStr: string): number {
    const match = dateStr.match(/^(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/);
    if (!match) return 0;
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    const multipliers: Record<string, number> = {
      second: 1000,
      minute: 60 * 1000,
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000
    };
    
    return value * multipliers[unit];
  }

  /**
   * Calculate file statistics from commits
   */
  private async calculateFileStats(commits: GitCommit[]): Promise<FileStats> {
    let additions = 0;
    let deletions = 0;
    const filesSet = new Set<string>();

    for (const commit of commits) {
      try {
        const stats = await this.git.show([commit.hash, '--stat', '--format=']);
        const lines = stats.split('\n');
        
        for (const line of lines) {
          if (line.includes('|')) {
            const parts = line.split('|');
            if (parts.length === 2) {
              const fileName = parts[0].trim();
              filesSet.add(fileName);
              
              const changes = parts[1].trim();
              const addMatch = changes.match(/(\d+)\s*\+/);
              const delMatch = changes.match(/(\d+)\s*-/);
              
              if (addMatch) additions += parseInt(addMatch[1]);
              if (delMatch) deletions += parseInt(delMatch[1]);
            }
          }
        }
      } catch (error) {
        // Skip commits that can't be accessed
        continue;
      }
    }

    return {
      additions,
      deletions,
      filesChanged: filesSet.size
    };
  }

  /**
   * Categorize commits by their functionality
   */
  private async categorizeCommits(commits: GitCommit[]): Promise<CommitCategory[]> {
    const categoryMappings: CategoryMapping[] = [
      {
        name: 'Dart AI Integration',
        commits: [],
        keywords: ['dart', 'dart ai', 'progress report', 'client report', 'dart integration']
      },
      {
        name: 'Document Management',
        commits: [],
        keywords: ['document', 'file', 'upload', 'storage', 'pdf', 'attachment']
      },
      {
        name: 'Real-Time Communication',
        commits: [],
        keywords: ['chat', 'message', 'realtime', 'real-time', 'socket', 'websocket', 'notification']
      },
      {
        name: 'Role-Based Access Control',
        commits: [],
        keywords: ['rbac', 'role', 'permission', 'access', 'auth', 'authorization', 'admin', 'user management']
      },
      {
        name: 'Legal Research Integration',
        commits: [],
        keywords: ['legal', 'law', 'research', 'parlant', 'case', 'statute', 'regulation']
      },
      {
        name: 'UI/UX Improvements',
        commits: [],
        keywords: ['ui', 'ux', 'style', 'css', 'design', 'layout', 'component', 'frontend', 'interface']
      },
      {
        name: 'Authentication System',
        commits: [],
        keywords: ['login', 'logout', 'session', 'password', 'security', 'oauth', 'jwt']
      },
      {
        name: 'System Configuration',
        commits: [],
        keywords: ['config', 'setup', 'environment', 'deploy', 'build', 'install', 'package']
      },
      {
        name: 'Data Management',
        commits: [],
        keywords: ['database', 'schema', 'migration', 'model', 'query', 'sql', 'drizzle', 'postgres']
      },
      {
        name: 'Notifications & Alerts',
        commits: [],
        keywords: ['notify', 'alert', 'email', 'sms', 'push', 'reminder', 'notification']
      },
      {
        name: 'General Improvements',
        commits: [],
        keywords: ['fix', 'update', 'improve', 'refactor', 'cleanup', 'optimize', 'bug', 'error']
      }
    ];

    // Categorize each commit
    for (const commit of commits) {
      const messageLower = commit.message.toLowerCase();
      let categorized = false;

      for (const category of categoryMappings) {
        for (const keyword of category.keywords) {
          if (messageLower.includes(keyword)) {
            category.commits.push(commit);
            categorized = true;
            break;
          }
        }
        if (categorized) break;
      }

      // If not categorized, add to general improvements
      if (!categorized) {
        const generalCategory = categoryMappings.find(c => c.name === 'General Improvements');
        if (generalCategory) {
          generalCategory.commits.push(commit);
        }
      }
    }

    // Convert to CommitCategory format and filter out empty categories
    return categoryMappings
      .filter(category => category.commits.length > 0)
      .map(category => ({
        name: category.name,
        commits: category.commits,
        keywords: category.keywords
      }));
  }

  /**
   * Get current git status
   */
  public async getGitStatus(): Promise<string> {
    try {
      const status = await this.git.status();
      if (status.files.length === 0) {
        return 'Working directory clean';
      }
      return status.files.map(file => `${file.index} ${file.path}`).join('\n');
    } catch (error) {
      return 'Could not determine git status';
    }
  }

  /**
   * Get current branch
   */
  public async getCurrentBranch(): Promise<string> {
    try {
      const branch = await this.git.branch();
      return branch.current;
    } catch (error) {
      return 'unknown';
    }
  }
}