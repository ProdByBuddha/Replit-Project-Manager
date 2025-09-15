import { GitCommit, ReplitAgentMetrics, EnhancedCommit } from '../types.js';
import { CommitCategory, CommitComplexity } from '../estimation/benchmarks.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Replit Agent Metrics Service
 * 
 * Estimates and tracks Replit Agent-specific metrics like time worked,
 * actions performed, items read, and agent usage costs.
 */

export class AgentMetricsService {
  private static instance: AgentMetricsService;
  private metricsHistory: Map<string, ReplitAgentMetrics> = new Map();
  private metricsFile: string;

  private constructor() {
    this.metricsFile = path.join(process.cwd(), '.rpm-metrics', 'agent-metrics.json');
    this.loadMetricsHistory();
  }

  public static getInstance(): AgentMetricsService {
    if (!AgentMetricsService.instance) {
      AgentMetricsService.instance = new AgentMetricsService();
    }
    return AgentMetricsService.instance;
  }

  /**
   * Load historical metrics from file
   */
  private async loadMetricsHistory(): Promise<void> {
    try {
      const data = await fs.readFile(this.metricsFile, 'utf-8');
      const history = JSON.parse(data);
      this.metricsHistory = new Map(Object.entries(history));
      console.log('[AgentMetrics] Loaded historical metrics for', this.metricsHistory.size, 'commits');
    } catch (error) {
      // File doesn't exist yet, that's okay
      console.log('[AgentMetrics] No historical metrics found, starting fresh');
    }
  }

  /**
   * Save metrics history to file
   */
  private async saveMetricsHistory(): Promise<void> {
    try {
      const dir = path.dirname(this.metricsFile);
      await fs.mkdir(dir, { recursive: true });
      
      const history = Object.fromEntries(this.metricsHistory);
      await fs.writeFile(this.metricsFile, JSON.stringify(history, null, 2));
      console.log('[AgentMetrics] Saved metrics for', this.metricsHistory.size, 'commits');
    } catch (error) {
      console.error('[AgentMetrics] Failed to save metrics:', error);
    }
  }

  /**
   * Estimate agent metrics for a commit based on its characteristics
   */
  public estimateMetricsForCommit(commit: GitCommit, category?: CommitCategory, complexity?: CommitComplexity): ReplitAgentMetrics {
    // Check if we have historical data for this commit
    const historical = this.metricsHistory.get(commit.hash);
    if (historical) {
      return historical;
    }

    // Estimate based on commit characteristics
    const filesChanged = commit.filesChanged || 1;
    const linesAdded = commit.linesAdded || 0;
    const linesDeleted = commit.linesDeleted || 0;
    const totalLinesChanged = linesAdded + linesDeleted;

    // Time worked estimation (in minutes)
    // Base: 15 min per commit + 5 min per file + 0.5 min per 10 lines
    let timeWorked = 15 + (filesChanged * 5) + (totalLinesChanged / 10 * 0.5);
    
    // Adjust for complexity
    const complexityMultipliers: Record<string, number> = {
      trivial: 0.5,
      small: 0.75,
      medium: 1.0,
      large: 1.5,
      huge: 2.0
    };
    if (complexity) {
      timeWorked *= complexityMultipliers[complexity] || 1.0;
    }

    // Work done estimation (number of actions)
    // Base: 10 actions per file + 1 action per 20 lines
    const workDone = Math.round(filesChanged * 10 + totalLinesChanged / 20);

    // Items read estimation (lines of code read for context)
    // Typically need to read 3-5x the lines changed for context
    const itemsRead = Math.round(totalLinesChanged * 4 + filesChanged * 100);

    // Agent usage cost estimation (in dollars)
    // Based on complexity and size of changes
    let agentUsage = 0.10; // Base cost
    
    // Add cost based on complexity
    const complexityCosts: Record<string, number> = {
      trivial: 0.05,
      small: 0.15,
      medium: 0.35,
      large: 0.75,
      huge: 1.50
    };
    if (complexity) {
      agentUsage += complexityCosts[complexity] || 0.35;
    }
    
    // Add cost based on scale
    agentUsage += filesChanged * 0.10;
    agentUsage += (totalLinesChanged / 100) * 0.20;

    // Category adjustments
    const categoryMultipliers: Record<string, number> = {
      feature: 1.2,
      bugfix: 0.9,
      refactor: 1.1,
      documentation: 0.6,
      test: 0.8,
      maintenance: 0.7,
      infrastructure: 1.0,
      security: 1.1,
      performance: 1.0,
      ui: 0.85
    };
    
    if (category) {
      const multiplier = categoryMultipliers[category as any] || 1.0;
      timeWorked *= multiplier;
      agentUsage *= multiplier;
    }

    const metrics: ReplitAgentMetrics = {
      timeWorked: Math.round(timeWorked),
      workDone,
      itemsRead,
      codeAdded: linesAdded,
      codeDeleted: linesDeleted,
      agentUsage: Math.round(agentUsage * 100) / 100, // Round to cents
      timestamp: commit.date
    };

    // Store for future use
    this.metricsHistory.set(commit.hash, metrics);
    
    return metrics;
  }

  /**
   * Enhance commits with agent metrics
   */
  public async enhanceCommitsWithMetrics(commits: GitCommit[]): Promise<EnhancedCommit[]> {
    const enhanced: EnhancedCommit[] = [];
    
    for (const commit of commits) {
      const category = this.categorizeCommit(commit.message);
      const complexity = this.calculateComplexity(commit);
      const estimatedMetrics = this.estimateMetricsForCommit(commit, category, complexity);
      
      enhanced.push({
        ...commit,
        estimatedMetrics: {
          timeWorked: estimatedMetrics.timeWorked || 0,
          workDone: estimatedMetrics.workDone || 0,
          itemsRead: estimatedMetrics.itemsRead || 0,
          agentUsage: estimatedMetrics.agentUsage || 0
        }
      });
    }
    
    // Save updated metrics
    await this.saveMetricsHistory();
    
    return enhanced;
  }

  /**
   * Calculate aggregate metrics for a set of commits
   */
  public calculateAggregateMetrics(commits: EnhancedCommit[]): ReplitAgentMetrics {
    const aggregate: ReplitAgentMetrics = {
      timeWorked: 0,
      workDone: 0,
      itemsRead: 0,
      codeAdded: 0,
      codeDeleted: 0,
      agentUsage: 0
    };

    for (const commit of commits) {
      const metrics = commit.estimatedMetrics || commit.agentMetrics;
      if (metrics) {
        aggregate.timeWorked! += metrics.timeWorked || 0;
        aggregate.workDone! += metrics.workDone || 0;
        aggregate.itemsRead! += metrics.itemsRead || 0;
        aggregate.codeAdded! += commit.linesAdded || 0;
        aggregate.codeDeleted! += commit.linesDeleted || 0;
        aggregate.agentUsage! += metrics.agentUsage || 0;
      }
    }

    // Round agent usage to 2 decimal places
    aggregate.agentUsage = Math.round(aggregate.agentUsage! * 100) / 100;

    return aggregate;
  }

  /**
   * Calculate per-commit average metrics
   */
  public calculateAverageMetrics(commits: EnhancedCommit[]): ReplitAgentMetrics {
    if (commits.length === 0) {
      return {
        timeWorked: 0,
        workDone: 0,
        itemsRead: 0,
        codeAdded: 0,
        codeDeleted: 0,
        agentUsage: 0
      };
    }

    const aggregate = this.calculateAggregateMetrics(commits);
    const count = commits.length;

    return {
      timeWorked: Math.round((aggregate.timeWorked || 0) / count),
      workDone: Math.round((aggregate.workDone || 0) / count),
      itemsRead: Math.round((aggregate.itemsRead || 0) / count),
      codeAdded: Math.round((aggregate.codeAdded || 0) / count),
      codeDeleted: Math.round((aggregate.codeDeleted || 0) / count),
      agentUsage: Math.round(((aggregate.agentUsage || 0) / count) * 100) / 100
    };
  }

  /**
   * Calculate productivity trends
   */
  public calculateProductivityTrends(commits: EnhancedCommit[]): {
    timeEfficiency: number;
    costEfficiency: number;
    productivityScore: number;
  } {
    if (commits.length < 2) {
      return {
        timeEfficiency: 0,
        costEfficiency: 0,
        productivityScore: 50
      };
    }

    // Split commits into two halves for trend analysis
    const midpoint = Math.floor(commits.length / 2);
    const firstHalf = commits.slice(0, midpoint);
    const secondHalf = commits.slice(midpoint);

    const firstMetrics = this.calculateAverageMetrics(firstHalf);
    const secondMetrics = this.calculateAverageMetrics(secondHalf);

    // Calculate efficiency trends (positive = improving)
    const timeEfficiency = firstMetrics.timeWorked && secondMetrics.timeWorked
      ? ((firstMetrics.timeWorked - secondMetrics.timeWorked) / firstMetrics.timeWorked) * 100
      : 0;

    const costEfficiency = firstMetrics.agentUsage && secondMetrics.agentUsage
      ? ((firstMetrics.agentUsage - secondMetrics.agentUsage) / firstMetrics.agentUsage) * 100
      : 0;

    // Calculate overall productivity score (0-100)
    const linesPerMinute = secondMetrics.timeWorked 
      ? ((secondMetrics.codeAdded || 0) + (secondMetrics.codeDeleted || 0)) / secondMetrics.timeWorked
      : 0;
    
    const actionsPerDollar = secondMetrics.agentUsage
      ? (secondMetrics.workDone || 0) / secondMetrics.agentUsage
      : 0;

    // Normalize to 0-100 scale
    const productivityScore = Math.min(100, Math.max(0, 
      50 + (linesPerMinute * 10) + (actionsPerDollar * 2) + (timeEfficiency / 2) + (costEfficiency / 2)
    ));

    return {
      timeEfficiency: Math.round(timeEfficiency * 10) / 10,
      costEfficiency: Math.round(costEfficiency * 10) / 10,
      productivityScore: Math.round(productivityScore)
    };
  }

  /**
   * Store actual checkpoint metrics (for future integration with Replit API)
   */
  public async storeCheckpointMetrics(
    commitHash: string, 
    metrics: ReplitAgentMetrics
  ): Promise<void> {
    this.metricsHistory.set(commitHash, metrics);
    await this.saveMetricsHistory();
  }

  /**
   * Get historical comparison for a commit
   */
  public getHistoricalComparison(
    commit: EnhancedCommit, 
    historicalAverage: ReplitAgentMetrics
  ): {
    timeVariance: number;
    costVariance: number;
    efficiencyRating: string;
  } {
    const metrics = commit.estimatedMetrics || commit.agentMetrics;
    if (!metrics) {
      return {
        timeVariance: 0,
        costVariance: 0,
        efficiencyRating: 'unknown'
      };
    }

    const timeVariance = historicalAverage.timeWorked
      ? ((metrics.timeWorked || 0) - historicalAverage.timeWorked) / historicalAverage.timeWorked * 100
      : 0;

    const costVariance = historicalAverage.agentUsage
      ? ((metrics.agentUsage || 0) - historicalAverage.agentUsage) / historicalAverage.agentUsage * 100
      : 0;

    let efficiencyRating = 'average';
    if (timeVariance < -20 && costVariance < -20) {
      efficiencyRating = 'excellent';
    } else if (timeVariance < -10 || costVariance < -10) {
      efficiencyRating = 'good';
    } else if (timeVariance > 20 || costVariance > 20) {
      efficiencyRating = 'needs improvement';
    }

    return {
      timeVariance: Math.round(timeVariance * 10) / 10,
      costVariance: Math.round(costVariance * 10) / 10,
      efficiencyRating
    };
  }

  /**
   * Helper: Categorize commit
   */
  private categorizeCommit(message: string): CommitCategory {
    const lowerMessage = message.toLowerCase();
    
    const categoryKeywords = {
      feature: ['add', 'implement', 'create', 'new', 'feature'],
      bugfix: ['fix', 'bug', 'issue', 'resolve', 'correct'],
      refactor: ['refactor', 'restructure', 'reorganize', 'cleanup'],
      documentation: ['doc', 'readme', 'comment'],
      test: ['test', 'spec', 'testing'],
      maintenance: ['update', 'upgrade', 'dependency'],
      infrastructure: ['deploy', 'config', 'build', 'ci'],
      security: ['security', 'auth', 'permission'],
      performance: ['performance', 'optimize', 'cache'],
      ui: ['ui', 'style', 'css', 'design', 'layout']
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => lowerMessage.includes(keyword))) {
        return category as CommitCategory;
      }
    }

    return 'maintenance' as CommitCategory;
  }

  /**
   * Helper: Calculate complexity
   */
  private calculateComplexity(commit: GitCommit): CommitComplexity {
    const filesChanged = commit.filesChanged || 1;
    const linesChanged = (commit.linesAdded || 0) + (commit.linesDeleted || 0);

    if (filesChanged === 1 && linesChanged < 10) return 'trivial' as CommitComplexity;
    if (filesChanged <= 3 && linesChanged < 50) return 'small' as CommitComplexity;
    if (filesChanged <= 10 && linesChanged < 200) return 'medium' as CommitComplexity;
    if (filesChanged <= 25 && linesChanged < 500) return 'large' as CommitComplexity;
    return 'huge' as CommitComplexity;
  }
}