import { IndustryBenchmarksService, CommitAnalysis, CommitCategory, CommitComplexity, ProjectParameters } from './benchmarks.js';
import { GitCommit } from '../types.js';

/**
 * Work Contribution Units (WCU) Development Effort Estimation Service
 * 
 * This service provides comprehensive development complexity quantification using git data analysis.
 * It implements a sophisticated mathematical model to estimate effort, costs, and project timelines
 * based on actual development patterns extracted from version control history.
 */

/**
 * Enhanced commit analysis data structure with WCU-specific metrics
 */
export interface WCUCommitAnalysis extends CommitAnalysis {
  rawWCU: number;
  adjustedWCU: number;
  keywordBoost: number;
  clusterId?: string;
  timeSincePrevious?: number;
  velocityScore: number;
}

/**
 * Feature cluster representing related development work
 */
export interface FeatureCluster {
  id: string;
  name: string;
  primaryCategory: CommitCategory;
  startDate: string;
  endDate: string;
  commits: WCUCommitAnalysis[];
  totalWCU: number;
  estimatedHours: number;
  confidence: number;
  keywords: string[];
}

/**
 * Effort estimation result using different methodologies
 */
export interface EffortEstimation {
  traditional: {
    hours: number;
    cost: number;
    personMonths: number;
    methodology: 'WCU-Traditional';
  };
  actual: {
    hours: number;
    cost: number;
    personMonths: number;
    methodology: 'Pattern-Based';
  };
  recommended: {
    hours: number;
    cost: number;
    personMonths: number;
    confidence: number;
    blendRatio: number;
  };
}

/**
 * Confidence scoring breakdown
 */
export interface ConfidenceScoring {
  overall: number;
  dataSufficiency: number;
  categorization: number;
  patternConsistency: number;
  temporalDistribution: number;
  breakdown: {
    commitsAnalyzed: number;
    categorizationSuccess: number;
    timeSpanDays: number;
    patternRegularity: number;
  };
}

/**
 * Comprehensive WCU estimation result
 */
export interface WCUEstimationResult {
  summary: {
    totalCommits: number;
    dateRange: string;
    totalWCU: number;
    adjustedWCU: number;
  };
  effort: EffortEstimation;
  clusters: FeatureCluster[];
  commits: WCUCommitAnalysis[];
  confidence: ConfidenceScoring;
  categoryBreakdown: Record<CommitCategory, {
    commits: number;
    wcu: number;
    hours: number;
    cost: number;
  }>;
  velocity: {
    commitsPerDay: number;
    wcuPerDay: number;
    peakPeriods: Array<{
      startDate: string;
      endDate: string;
      avgCommitsPerDay: number;
      avgWCUPerDay: number;
    }>;
  };
}

/**
 * Estimation configuration parameters
 */
export interface EstimationConfig extends Partial<ProjectParameters> {
  sinceDate?: string;
  untilDate?: string;
  minCommitsThreshold?: number;
  clusteringWindow?: number;
  keywordBoosts?: Record<string, number>;
  customWeights?: {
    commits?: number;
    filesChanged?: number;
    additions?: number;
    deletions?: number;
  };
}

/**
 * Work Contribution Units Estimator
 */
export class WorkContributionEstimator {
  private static instance: WorkContributionEstimator;
  private benchmarksService: IndustryBenchmarksService;
  private initialized = false;

  private constructor() {
    this.benchmarksService = IndustryBenchmarksService.getInstance();
  }

  public static getInstance(): WorkContributionEstimator {
    if (!WorkContributionEstimator.instance) {
      WorkContributionEstimator.instance = new WorkContributionEstimator();
    }
    return WorkContributionEstimator.instance;
  }

  /**
   * Initialize the estimator
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;
    
    console.log('[WCU Estimator] Initializing Work Contribution Units estimator...');
    await this.benchmarksService.initialize();
    this.initialized = true;
    console.log('[WCU Estimator] Initialization complete');
  }

  /**
   * Estimate development effort from git history
   */
  public async estimateFromGitHistory(
    commits: GitCommit[],
    config: EstimationConfig = {}
  ): Promise<WCUEstimationResult> {
    console.log('[WCU Estimator] Starting estimation from git history...');
    
    if (!this.initialized) {
      await this.initialize();
    }

    // Convert GitCommit to CommitAnalysis
    const commitAnalyses = await this.analyzeCommits(commits, config);
    
    // Calculate WCU scores
    const wcuCommits = await this.calculateWCUScores(commitAnalyses, config);
    
    // Create feature clusters
    const clusters = await this.createFeatureClusters(wcuCommits, config);
    
    // Calculate effort estimations
    const effort = await this.calculateEffortEstimations(wcuCommits, config);
    
    // Calculate confidence
    const confidence = this.calculateConfidence(wcuCommits, clusters);
    
    // Calculate category breakdown
    const categoryBreakdown = this.calculateCategoryBreakdown(wcuCommits);
    
    // Calculate velocity metrics
    const velocity = this.calculateVelocityMetrics(wcuCommits);
    
    const totalWCU = wcuCommits.reduce((sum, commit) => sum + commit.rawWCU, 0);
    const adjustedWCU = wcuCommits.reduce((sum, commit) => sum + commit.adjustedWCU, 0);
    
    const dateRange = commits.length > 0 
      ? `${commits[commits.length - 1]?.date} to ${commits[0]?.date}`
      : 'No commits';

    console.log(`[WCU Estimator] Estimation complete: ${commits.length} commits, ${clusters.length} clusters, ${Math.round(effort.traditional.hours)} hours estimated`);

    return {
      summary: {
        totalCommits: commits.length,
        dateRange,
        totalWCU,
        adjustedWCU
      },
      effort,
      clusters,
      commits: wcuCommits,
      confidence,
      categoryBreakdown,
      velocity
    };
  }

  /**
   * Analyze commits and categorize them
   */
  private async analyzeCommits(commits: GitCommit[], config: EstimationConfig): Promise<CommitAnalysis[]> {
    const analyses: CommitAnalysis[] = [];
    
    for (const commit of commits) {
      const category = this.categorizeCommit(commit.message);
      const complexity = this.calculateComplexity(commit);
      
      analyses.push({
        hash: commit.hash,
        author: commit.author,
        date: commit.date,
        message: commit.message,
        filesChanged: commit.filesChanged || 1,
        linesAdded: commit.linesAdded || 0,
        linesDeleted: commit.linesDeleted || 0,
        category,
        complexity
      });
    }
    
    return analyses;
  }

  /**
   * Categorize a commit based on its message
   */
  private categorizeCommit(message: string): CommitCategory {
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
        return category as CommitCategory;
      }
    }

    return 'maintenance'; // default
  }

  /**
   * Calculate commit complexity
   */
  private calculateComplexity(commit: GitCommit): CommitComplexity {
    const filesChanged = commit.filesChanged || 1;
    const linesChanged = (commit.linesAdded || 0) + (commit.linesDeleted || 0);

    if (filesChanged === 1 && linesChanged < 10) return 'trivial';
    if (filesChanged <= 3 && linesChanged < 50) return 'small';
    if (filesChanged <= 10 && linesChanged < 200) return 'medium';
    if (filesChanged <= 25 && linesChanged < 500) return 'large';
    return 'huge';
  }

  /**
   * Calculate WCU scores for commits
   */
  private async calculateWCUScores(
    commits: CommitAnalysis[],
    config: EstimationConfig
  ): Promise<WCUCommitAnalysis[]> {
    const wcuCommits: WCUCommitAnalysis[] = [];
    
    for (let i = 0; i < commits.length; i++) {
      const commit = commits[i];
      const wcuResult = this.benchmarksService.calculateWCU([commit]);
      
      const keywordBoost = this.calculateKeywordBoost(commit.message, config.keywordBoosts);
      const timeSincePrevious = i > 0 ? this.calculateTimeDifference(commits[i-1].date, commit.date) : 0;
      const velocityScore = this.calculateVelocityScore(commit, timeSincePrevious);
      
      wcuCommits.push({
        ...commit,
        rawWCU: wcuResult.rawWCU,
        adjustedWCU: wcuResult.adjustedWCU * keywordBoost,
        keywordBoost,
        timeSincePrevious,
        velocityScore
      });
    }
    
    return wcuCommits;
  }

  /**
   * Calculate keyword boost factor
   */
  private calculateKeywordBoost(message: string, customBoosts?: Record<string, number>): number {
    const defaultBoosts = {
      'breaking change': 1.5,
      'major': 1.3,
      'critical': 1.4,
      'urgent': 1.2,
      'hotfix': 1.1,
      ...customBoosts
    };

    let boost = 1.0;
    const lowerMessage = message.toLowerCase();
    
    for (const [keyword, multiplier] of Object.entries(defaultBoosts)) {
      if (lowerMessage.includes(keyword)) {
        boost = Math.max(boost, multiplier);
      }
    }
    
    return boost;
  }

  /**
   * Calculate time difference between commits in hours
   */
  private calculateTimeDifference(date1: string, date2: string): number {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60);
  }

  /**
   * Calculate velocity score for a commit
   */
  private calculateVelocityScore(commit: CommitAnalysis, timeSincePrevious: number): number {
    // Base score from complexity
    const complexityScores = {
      trivial: 1,
      small: 2,
      medium: 4,
      large: 7,
      huge: 10
    };
    
    let score = complexityScores[commit.complexity];
    
    // Adjust for development pace
    if (timeSincePrevious > 0) {
      if (timeSincePrevious < 1) score *= 1.2; // Fast iteration
      else if (timeSincePrevious > 24) score *= 0.8; // Slow iteration
    }
    
    return score;
  }

  /**
   * Create feature clusters from commits
   */
  private async createFeatureClusters(
    commits: WCUCommitAnalysis[],
    config: EstimationConfig
  ): Promise<FeatureCluster[]> {
    const clusters: FeatureCluster[] = [];
    const clusteringWindow = config.clusteringWindow || 72; // 72 hours
    
    // Simple clustering by time windows and category
    const processed = new Set<string>();
    
    for (const commit of commits) {
      if (processed.has(commit.hash)) continue;
      
      const cluster: FeatureCluster = {
        id: `cluster-${clusters.length + 1}`,
        name: `${commit.category} cluster`,
        primaryCategory: commit.category,
        startDate: commit.date,
        endDate: commit.date,
        commits: [commit],
        totalWCU: commit.adjustedWCU,
        estimatedHours: 0,
        confidence: 0.8,
        keywords: [commit.category]
      };
      
      processed.add(commit.hash);
      
      // Find related commits within time window
      for (const otherCommit of commits) {
        if (processed.has(otherCommit.hash)) continue;
        
        const timeDiff = this.calculateTimeDifference(commit.date, otherCommit.date);
        if (timeDiff <= clusteringWindow && otherCommit.category === commit.category) {
          cluster.commits.push(otherCommit);
          cluster.totalWCU += otherCommit.adjustedWCU;
          processed.add(otherCommit.hash);
          
          // Update date range
          if (new Date(otherCommit.date) < new Date(cluster.startDate)) {
            cluster.startDate = otherCommit.date;
          }
          if (new Date(otherCommit.date) > new Date(cluster.endDate)) {
            cluster.endDate = otherCommit.date;
          }
        }
      }
      
      // Estimate hours for this cluster
      cluster.estimatedHours = cluster.totalWCU * 2.5; // Default hours per WCU
      
      clusters.push(cluster);
    }
    
    return clusters;
  }

  /**
   * Calculate effort estimations using different methodologies
   */
  private async calculateEffortEstimations(
    commits: WCUCommitAnalysis[],
    config: EstimationConfig
  ): Promise<EffortEstimation> {
    const totalWCU = commits.reduce((sum, c) => sum + c.adjustedWCU, 0);
    const hoursPerWCU = 2.5;
    const hourlyRate = 85;
    
    // Traditional WCU-based estimation
    const traditionalHours = totalWCU * hoursPerWCU;
    const traditionalCost = traditionalHours * hourlyRate;
    
    // Pattern-based estimation (simplified)
    const avgCommitsPerDay = commits.length / 30; // assume 30-day analysis
    const hoursPerCommit = 3; // estimated average
    const actualHours = commits.length * hoursPerCommit;
    const actualCost = actualHours * hourlyRate;
    
    // Blended recommendation
    const blendRatio = 0.7; // 70% traditional, 30% actual
    const recommendedHours = traditionalHours * blendRatio + actualHours * (1 - blendRatio);
    const recommendedCost = recommendedHours * hourlyRate;
    
    return {
      traditional: {
        hours: traditionalHours,
        cost: traditionalCost,
        personMonths: traditionalHours / 176, // 22 days * 8 hours
        methodology: 'WCU-Traditional'
      },
      actual: {
        hours: actualHours,
        cost: actualCost,
        personMonths: actualHours / 176,
        methodology: 'Pattern-Based'
      },
      recommended: {
        hours: recommendedHours,
        cost: recommendedCost,
        personMonths: recommendedHours / 176,
        confidence: 0.75,
        blendRatio
      }
    };
  }

  /**
   * Calculate confidence scoring
   */
  private calculateConfidence(commits: WCUCommitAnalysis[], clusters: FeatureCluster[]): ConfidenceScoring {
    const commitsAnalyzed = commits.length;
    const categorizationSuccess = 100; // Assume 100% for now
    
    const dates = commits.map(c => new Date(c.date));
    const timeSpanDays = dates.length > 0 
      ? (Math.max(...dates.map(d => d.getTime())) - Math.min(...dates.map(d => d.getTime()))) / (1000 * 60 * 60 * 24)
      : 0;
    
    const dataSufficiency = Math.min(100, (commitsAnalyzed / 50) * 100);
    const categorization = categorizationSuccess;
    const patternConsistency = Math.min(100, (clusters.length / Math.max(1, commitsAnalyzed / 10)) * 100);
    const temporalDistribution = Math.min(100, timeSpanDays * 2);
    
    const overall = (dataSufficiency * 0.4 + categorization * 0.25 + patternConsistency * 0.25 + temporalDistribution * 0.1);
    
    return {
      overall,
      dataSufficiency,
      categorization,
      patternConsistency,
      temporalDistribution,
      breakdown: {
        commitsAnalyzed,
        categorizationSuccess,
        timeSpanDays,
        patternRegularity: patternConsistency
      }
    };
  }

  /**
   * Calculate category breakdown
   */
  private calculateCategoryBreakdown(commits: WCUCommitAnalysis[]): Record<CommitCategory, any> {
    const breakdown: Record<string, any> = {};
    const hourlyRate = 85;
    
    for (const commit of commits) {
      if (!breakdown[commit.category]) {
        breakdown[commit.category] = {
          commits: 0,
          wcu: 0,
          hours: 0,
          cost: 0
        };
      }
      
      breakdown[commit.category].commits++;
      breakdown[commit.category].wcu += commit.adjustedWCU;
      breakdown[commit.category].hours += commit.adjustedWCU * 2.5;
      breakdown[commit.category].cost += commit.adjustedWCU * 2.5 * hourlyRate;
    }
    
    return breakdown as Record<CommitCategory, any>;
  }

  /**
   * Calculate velocity metrics
   */
  private calculateVelocityMetrics(commits: WCUCommitAnalysis[]): any {
    if (commits.length === 0) {
      return {
        commitsPerDay: 0,
        wcuPerDay: 0,
        peakPeriods: []
      };
    }
    
    const dates = commits.map(c => new Date(c.date));
    const timeSpanDays = Math.max(1, (Math.max(...dates.map(d => d.getTime())) - Math.min(...dates.map(d => d.getTime()))) / (1000 * 60 * 60 * 24));
    
    const commitsPerDay = commits.length / timeSpanDays;
    const totalWCU = commits.reduce((sum, c) => sum + c.adjustedWCU, 0);
    const wcuPerDay = totalWCU / timeSpanDays;
    
    return {
      commitsPerDay,
      wcuPerDay,
      peakPeriods: [] // Simplified for now
    };
  }
}