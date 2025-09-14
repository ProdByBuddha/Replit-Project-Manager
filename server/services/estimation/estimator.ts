import { IndustryBenchmarksService, CommitAnalysis, CommitCategory, CommitComplexity, ProjectParameters } from './benchmarks.js';
import { GitIntegratedProgressService } from '../gitIntegratedProgress.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Work Contribution Units (WCU) Development Effort Estimation Service
 * 
 * This service provides comprehensive development complexity quantification using git data analysis.
 * It implements a sophisticated mathematical model to estimate effort, costs, and project timelines
 * based on actual development patterns extracted from version control history.
 * 
 * Key Features:
 * - Mathematical WCU calculation with configurable weights and caps
 * - Keyword boost analysis for commit message categorization  
 * - Feature clustering to group related development work
 * - Traditional and actual effort estimation methodologies
 * - Confidence scoring based on data quality and completeness
 * - Integration with industry-standard benchmarks and metrics
 * 
 * @example
 * ```typescript
 * const estimator = WorkContributionEstimator.getInstance();
 * await estimator.initialize();
 * 
 * const estimation = await estimator.estimateFromGitHistory({
 *   sinceDate: '6 months ago',
 *   projectType: 'webApplication',
 *   region: 'northAmerica'
 * });
 * 
 * console.log(`Project effort: ${estimation.totalEffort.hours} hours`);
 * console.log(`Estimated cost: $${estimation.totalEffort.cost}`);
 * console.log(`Confidence: ${estimation.confidence.overall}%`);
 * ```
 * 
 * @author Development Team
 * @version 1.0.0
 */

/**
 * Enhanced commit analysis data structure with WCU-specific metrics
 */
export interface WCUCommitAnalysis extends CommitAnalysis {
  /** Raw WCU score for this commit */
  rawWCU: number;
  /** Category-adjusted WCU score */
  adjustedWCU: number;
  /** Keyword boost factor applied */
  keywordBoost: number;
  /** Feature cluster this commit belongs to */
  clusterId?: string;
  /** Time since previous commit in hours */
  timeSincePrevious?: number;
  /** Development velocity indicator */
  velocityScore: number;
}

/**
 * Feature cluster representing related development work
 */
export interface FeatureCluster {
  /** Unique cluster identifier */
  id: string;
  /** Human-readable cluster name */
  name: string;
  /** Primary category of work in this cluster */
  primaryCategory: CommitCategory;
  /** Time window start */
  startDate: string;
  /** Time window end */
  endDate: string;
  /** Commits belonging to this cluster */
  commits: WCUCommitAnalysis[];
  /** Aggregate WCU score for the cluster */
  totalWCU: number;
  /** Estimated effort for this feature */
  estimatedHours: number;
  /** Confidence in this clustering */
  confidence: number;
  /** Keywords that defined this cluster */
  keywords: string[];
}

/**
 * Effort estimation result using different methodologies
 */
export interface EffortEstimation {
  /** Traditional WCU-based estimation */
  traditional: {
    /** Total effort in person-hours */
    hours: number;
    /** Total cost in USD */
    cost: number;
    /** Number of person-months */
    personMonths: number;
    /** Methodology used */
    methodology: 'WCU-Traditional';
  };
  /** Actual pattern-based estimation */
  actual: {
    /** Estimated hours based on commit patterns */
    hours: number;
    /** Estimated cost */
    cost: number;
    /** Person-months */
    personMonths: number;
    /** Methodology used */
    methodology: 'Pattern-Based';
  };
  /** Recommended estimation (blend of traditional and actual) */
  recommended: {
    /** Blended hours estimate */
    hours: number;
    /** Blended cost estimate */
    cost: number;
    /** Person-months */
    personMonths: number;
    /** Confidence in recommendation */
    confidence: number;
    /** Blending ratio used */
    blendRatio: number;
  };
}

/**
 * Confidence scoring breakdown
 */
export interface ConfidenceScoring {
  /** Overall confidence score (0-100) */
  overall: number;
  /** Data sufficiency score */
  dataSufficiency: number;
  /** Categorization accuracy score */
  categorization: number;
  /** Pattern consistency score */
  patternConsistency: number;
  /** Temporal distribution score */
  temporalDistribution: number;
  /** Detailed scoring breakdown */
  breakdown: {
    /** Number of commits analyzed */
    commitsAnalyzed: number;
    /** Percentage successfully categorized */
    categorizationSuccess: number;
    /** Time span coverage in days */
    timeSpanDays: number;
    /** Pattern regularity score */
    patternRegularity: number;
  };
}

/**
 * Comprehensive WCU estimation result
 */
export interface WCUEstimationResult {
  /** Summary metrics */
  summary: {
    /** Total commits analyzed */
    totalCommits: number;
    /** Date range analyzed */
    dateRange: string;
    /** Total raw WCU score */
    totalWCU: number;
    /** Total adjusted WCU score */
    adjustedWCU: number;
  };
  /** Effort estimations using different methodologies */
  effort: EffortEstimation;
  /** Feature clusters identified */
  clusters: FeatureCluster[];
  /** Individual commit analysis */
  commits: WCUCommitAnalysis[];
  /** Confidence scoring */
  confidence: ConfidenceScoring;
  /** Breakdown by category */
  categoryBreakdown: Record<CommitCategory, {
    commits: number;
    wcu: number;
    hours: number;
    cost: number;
  }>;
  /** Development velocity metrics */
  velocity: {
    /** Commits per day average */
    commitsPerDay: number;
    /** WCU per day average */
    wcuPerDay: number;
    /** Peak productivity periods */
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
  /** Date to start analysis from */
  sinceDate?: string;
  /** Date to end analysis at */
  untilDate?: string;
  /** Minimum commits required for reliable estimation */
  minCommitsThreshold?: number;
  /** Time window for feature clustering in hours */
  clusteringWindow?: number;
  /** Keyword boost configuration */
  keywordBoosts?: Record<string, number>;
  /** Custom WCU weight overrides */
  customWeights?: {
    commits?: number;
    filesChanged?: number;
    additions?: number;
    deletions?: number;
  };
  /** Custom caps for realistic estimates */
  customCaps?: {
    filesChanged?: number;
    additions?: number;
    deletions?: number;
  };
}

/**
 * Work Contribution Units Development Effort Estimation Service
 * 
 * Provides comprehensive development complexity quantification using git data analysis
 * with mathematical WCU calculations, feature clustering, and confidence scoring.
 */
export class WorkContributionEstimator {
  private static instance: WorkContributionEstimator;
  private benchmarksService: IndustryBenchmarksService;
  private gitService: GitIntegratedProgressService;
  private initialized: boolean = false;

  private constructor() {
    this.benchmarksService = IndustryBenchmarksService.getInstance();
    this.gitService = GitIntegratedProgressService.getInstance();
  }

  /**
   * Get singleton instance of the WCU estimator
   */
  public static getInstance(): WorkContributionEstimator {
    if (!WorkContributionEstimator.instance) {
      WorkContributionEstimator.instance = new WorkContributionEstimator();
    }
    return WorkContributionEstimator.instance;
  }

  /**
   * Initialize the estimator service
   * 
   * @throws Error if initialization fails
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('[WCU Estimator] Initializing Work Contribution Units estimator...');
      
      // Initialize dependencies
      await this.benchmarksService.initialize();
      
      this.initialized = true;
      console.log('[WCU Estimator] Initialization complete');
    } catch (error) {
      console.error('[WCU Estimator] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Estimate development effort from git history
   * 
   * @param config Estimation configuration parameters
   * @returns Comprehensive WCU estimation result
   * 
   * @example
   * ```typescript
   * const estimation = await estimator.estimateFromGitHistory({
   *   sinceDate: '3 months ago',
   *   projectType: 'webApplication',
   *   region: 'northAmerica',
   *   minCommitsThreshold: 20
   * });
   * ```
   */
  public async estimateFromGitHistory(config: EstimationConfig = {}): Promise<WCUEstimationResult> {
    if (!this.initialized) {
      throw new Error('WorkContributionEstimator not initialized');
    }

    console.log('[WCU Estimator] Starting estimation from git history...');
    
    // Get git commit data with detailed stats
    const gitData = await this.extractDetailedGitData(config);
    
    // Analyze commits with WCU calculations
    const commits = await this.analyzeCommitsWithWCU(gitData, config);
    
    // Perform feature clustering
    const clusters = await this.clusterFeatures(commits, config);
    
    // Calculate effort estimations
    const effort = await this.calculateEffortEstimations(commits, clusters, config);
    
    // Calculate confidence scoring
    const confidence = this.calculateConfidenceScoring(commits, clusters);
    
    // Generate category breakdown
    const categoryBreakdown = this.generateCategoryBreakdown(commits);
    
    // Calculate velocity metrics
    const velocity = this.calculateVelocityMetrics(commits);
    
    const result: WCUEstimationResult = {
      summary: {
        totalCommits: commits.length,
        dateRange: this.calculateDateRange(commits),
        totalWCU: commits.reduce((sum, c) => sum + c.rawWCU, 0),
        adjustedWCU: commits.reduce((sum, c) => sum + c.adjustedWCU, 0)
      },
      effort,
      clusters,
      commits,
      confidence,
      categoryBreakdown,
      velocity
    };

    console.log(`[WCU Estimator] Estimation complete: ${commits.length} commits, ${clusters.length} clusters, ${Math.round(effort.recommended.hours)} hours estimated`);
    
    return result;
  }

  /**
   * Calculate WCU score for a single commit using the mathematical formula
   * 
   * Formula: WCU = w_c*commits + w_f*min(filesChanged,cap_f) + w_add*min(additions,cap_a) + w_del*min(deletions,cap_d)
   * 
   * @param commit Commit data to analyze
   * @param config Estimation configuration
   * @returns WCU score breakdown
   * 
   * @example
   * ```typescript
   * const wcuScore = await estimator.calculateCommitWCU({
   *   hash: 'abc123',
   *   message: 'Add new user authentication feature',
   *   filesChanged: 5,
   *   linesAdded: 150,
   *   linesDeleted: 20,
   *   // ... other commit data
   * });
   * ```
   */
  public async calculateCommitWCU(
    commit: CommitAnalysis, 
    config: EstimationConfig = {}
  ): Promise<{
    rawWCU: number;
    adjustedWCU: number;
    breakdown: {
      commits: number;
      filesChanged: number;
      additions: number;
      deletions: number;
      complexityMultiplier: number;
      categoryMultiplier: number;
      keywordBoost: number;
    };
  }> {
    // Get weights from benchmarks with config overrides
    const weights = await this.getWCUWeights(config);
    const caps = await this.getWCUCaps(config);
    
    // Calculate base components using the mathematical formula
    const commitsComponent = weights.commits * 1; // Always 1 commit
    const filesComponent = weights.filesChanged * Math.min(commit.filesChanged, caps.filesChanged);
    const additionsComponent = weights.additions * Math.min(commit.linesAdded, caps.additions);
    const deletionsComponent = weights.deletions * Math.min(commit.linesDeleted, caps.deletions);
    
    // Calculate raw WCU
    const rawWCU = commitsComponent + filesComponent + additionsComponent + deletionsComponent;
    
    // Apply multipliers
    const complexityMultiplier = await this.getComplexityMultiplier(commit.complexity);
    const categoryMultiplier = await this.getCategoryMultiplier(commit.category);
    const keywordBoost = await this.calculateKeywordBoost(commit.message, config);
    
    // Calculate adjusted WCU
    const adjustedWCU = rawWCU * complexityMultiplier * categoryMultiplier * keywordBoost;
    
    return {
      rawWCU,
      adjustedWCU,
      breakdown: {
        commits: commitsComponent,
        filesChanged: filesComponent,
        additions: additionsComponent,
        deletions: deletionsComponent,
        complexityMultiplier,
        categoryMultiplier,
        keywordBoost
      }
    };
  }

  /**
   * Extract detailed git data with file changes and statistics
   * 
   * @private
   */
  private async extractDetailedGitData(config: EstimationConfig): Promise<string> {
    const sinceFlag = config.sinceDate ? ` --since="${config.sinceDate}"` : '';
    const untilFlag = config.untilDate ? ` --until="${config.untilDate}"` : '';
    
    try {
      // Get detailed commit data with file statistics
      const { stdout } = await execAsync(
        `git log --pretty=format:"%H|%an|%ad|%s" --date=iso --numstat${sinceFlag}${untilFlag}`
      );
      
      return stdout;
    } catch (error) {
      console.error('[WCU Estimator] Failed to extract git data:', error);
      throw new Error('Failed to extract git repository data');
    }
  }

  /**
   * Analyze commits with detailed WCU calculations
   * 
   * @private
   */
  private async analyzeCommitsWithWCU(
    gitData: string, 
    config: EstimationConfig
  ): Promise<WCUCommitAnalysis[]> {
    const commits: WCUCommitAnalysis[] = [];
    const lines = gitData.split('\n').filter(line => line.trim());
    
    let currentCommit: Partial<WCUCommitAnalysis> | null = null;
    let previousCommitDate: Date | null = null;
    
    for (const line of lines) {
      if (line.includes('|')) {
        // Process previous commit if exists
        if (currentCommit && currentCommit.hash) {
          const wcuResult = await this.calculateCommitWCU(currentCommit as CommitAnalysis, config);
          const velocityScore = this.calculateVelocityScore(currentCommit, previousCommitDate);
          
          commits.push({
            ...currentCommit as CommitAnalysis,
            rawWCU: wcuResult.rawWCU,
            adjustedWCU: wcuResult.adjustedWCU,
            keywordBoost: wcuResult.breakdown.keywordBoost,
            velocityScore,
            timeSincePrevious: previousCommitDate ? 
              (new Date(currentCommit.date!).getTime() - previousCommitDate.getTime()) / (1000 * 60 * 60) : undefined
          });
          
          previousCommitDate = new Date(currentCommit.date!);
        }
        
        // Parse new commit header
        const [hash, author, date, message] = line.split('|');
        currentCommit = {
          hash,
          author,
          date,
          message,
          filesChanged: 0,
          linesAdded: 0,
          linesDeleted: 0,
          category: this.categorizeCommitMessage(message),
          complexity: 'small' // Will be updated based on file stats
        };
      } else if (currentCommit && line.match(/^\d+\s+\d+\s/)) {
        // Parse file statistics line: "additions deletions filename"
        const [additions, deletions] = line.split('\t');
        currentCommit.linesAdded = (currentCommit.linesAdded || 0) + (parseInt(additions) || 0);
        currentCommit.linesDeleted = (currentCommit.linesDeleted || 0) + (parseInt(deletions) || 0);
        currentCommit.filesChanged = (currentCommit.filesChanged || 0) + 1;
      }
    }
    
    // Process final commit
    if (currentCommit && currentCommit.hash) {
      const wcuResult = await this.calculateCommitWCU(currentCommit as CommitAnalysis, config);
      const velocityScore = this.calculateVelocityScore(currentCommit, previousCommitDate);
      
      commits.push({
        ...currentCommit as CommitAnalysis,
        rawWCU: wcuResult.rawWCU,
        adjustedWCU: wcuResult.adjustedWCU,
        keywordBoost: wcuResult.breakdown.keywordBoost,
        velocityScore,
        timeSincePrevious: previousCommitDate ? 
          (new Date(currentCommit.date!).getTime() - previousCommitDate.getTime()) / (1000 * 60 * 60) : undefined
      });
    }
    
    // Update complexity based on actual file statistics
    commits.forEach(commit => {
      commit.complexity = this.assessCommitComplexity(
        commit.filesChanged,
        commit.linesAdded,
        commit.linesDeleted
      );
    });
    
    return commits.filter(commit => commit.hash); // Filter out incomplete commits
  }

  /**
   * Perform feature clustering to group related commits
   * 
   * @private
   */
  private async clusterFeatures(
    commits: WCUCommitAnalysis[], 
    config: EstimationConfig
  ): Promise<FeatureCluster[]> {
    const clusters: FeatureCluster[] = [];
    const clusteringWindow = config.clusteringWindow || 48; // 48 hours default
    const processedCommits = new Set<string>();
    
    for (const commit of commits) {
      if (processedCommits.has(commit.hash)) continue;
      
      // Find related commits within time window and keyword similarity
      const relatedCommits = this.findRelatedCommits(commit, commits, clusteringWindow);
      
      if (relatedCommits.length >= 2) { // Minimum cluster size
        const clusterId = `cluster-${clusters.length + 1}`;
        const clusterKeywords = this.extractClusterKeywords(relatedCommits);
        
        const cluster: FeatureCluster = {
          id: clusterId,
          name: this.generateClusterName(relatedCommits, clusterKeywords),
          primaryCategory: this.determinePrimaryCategory(relatedCommits),
          startDate: relatedCommits[relatedCommits.length - 1].date,
          endDate: relatedCommits[0].date,
          commits: relatedCommits,
          totalWCU: relatedCommits.reduce((sum, c) => sum + c.adjustedWCU, 0),
          estimatedHours: 0, // Will be calculated
          confidence: this.calculateClusterConfidence(relatedCommits, clusterKeywords),
          keywords: clusterKeywords
        };
        
        // Calculate estimated hours for this cluster
        cluster.estimatedHours = await this.calculateClusterEffort(cluster, config);
        
        // Mark commits as processed and assign cluster ID
        relatedCommits.forEach(c => {
          processedCommits.add(c.hash);
          c.clusterId = clusterId;
        });
        
        clusters.push(cluster);
      }
    }
    
    return clusters;
  }

  /**
   * Calculate effort estimations using multiple methodologies
   * 
   * @private
   */
  private async calculateEffortEstimations(
    commits: WCUCommitAnalysis[],
    clusters: FeatureCluster[],
    config: EstimationConfig
  ): Promise<EffortEstimation> {
    // Traditional WCU-based estimation
    const totalAdjustedWCU = commits.reduce((sum, c) => sum + c.adjustedWCU, 0);
    const baseHoursPerWCU = 3.2; // From benchmarks
    const traditionalHours = totalAdjustedWCU * baseHoursPerWCU;
    const blendedRate = await this.calculateBlendedRate(config);
    const traditionalCost = traditionalHours * blendedRate;
    
    // Actual pattern-based estimation
    const avgCommitsPerDay = this.calculateAverageCommitsPerDay(commits);
    const avgHoursPerCommit = this.estimateHoursPerCommit(commits);
    const actualHours = commits.length * avgHoursPerCommit;
    const actualCost = actualHours * blendedRate;
    
    // Recommended blend (70% traditional, 30% actual for balance)
    const blendRatio = 0.7;
    const recommendedHours = (traditionalHours * blendRatio) + (actualHours * (1 - blendRatio));
    const recommendedCost = recommendedHours * blendedRate;
    const confidence = this.calculateEstimationConfidence(commits, clusters);
    
    return {
      traditional: {
        hours: traditionalHours,
        cost: traditionalCost,
        personMonths: traditionalHours / (22 * 8),
        methodology: 'WCU-Traditional'
      },
      actual: {
        hours: actualHours,
        cost: actualCost,
        personMonths: actualHours / (22 * 8),
        methodology: 'Pattern-Based'
      },
      recommended: {
        hours: recommendedHours,
        cost: recommendedCost,
        personMonths: recommendedHours / (22 * 8),
        confidence,
        blendRatio
      }
    };
  }

  /**
   * Calculate comprehensive confidence scoring
   * 
   * @private
   */
  private calculateConfidenceScoring(
    commits: WCUCommitAnalysis[],
    clusters: FeatureCluster[]
  ): ConfidenceScoring {
    // Data sufficiency scoring
    const minCommits = 10;
    const dataSufficiency = Math.min(100, (commits.length / minCommits) * 100);
    
    // Categorization accuracy
    const categorizedCommits = commits.filter(c => c.category !== 'maintenance').length;
    const categorization = (categorizedCommits / commits.length) * 100;
    
    // Pattern consistency
    const avgWCU = commits.reduce((sum, c) => sum + c.adjustedWCU, 0) / commits.length;
    const variance = commits.reduce((sum, c) => sum + Math.pow(c.adjustedWCU - avgWCU, 2), 0) / commits.length;
    const patternConsistency = Math.max(0, 100 - (Math.sqrt(variance) / avgWCU) * 100);
    
    // Temporal distribution
    const timeSpanDays = this.calculateTimeSpanDays(commits);
    const temporalDistribution = Math.min(100, (timeSpanDays / 30) * 100); // Good if >= 30 days
    
    // Overall confidence (weighted average)
    const overall = (
      dataSufficiency * 0.3 +
      categorization * 0.25 +
      patternConsistency * 0.25 +
      temporalDistribution * 0.2
    );
    
    return {
      overall: Math.round(overall),
      dataSufficiency: Math.round(dataSufficiency),
      categorization: Math.round(categorization),
      patternConsistency: Math.round(patternConsistency),
      temporalDistribution: Math.round(temporalDistribution),
      breakdown: {
        commitsAnalyzed: commits.length,
        categorizationSuccess: categorization,
        timeSpanDays,
        patternRegularity: patternConsistency
      }
    };
  }

  /**
   * Get WCU weights from benchmarks with config overrides
   * @private
   */
  private async getWCUWeights(config: EstimationConfig): Promise<{
    commits: number;
    filesChanged: number;
    additions: number;
    deletions: number;
  }> {
    const benchmarkWeights = this.benchmarksService.getBenchmarkValue('workContributionUnits.weights');
    
    return {
      commits: config.customWeights?.commits || benchmarkWeights?.commits?.base || 1.0,
      filesChanged: config.customWeights?.filesChanged || benchmarkWeights?.filesChanged?.modified || 1.5,
      additions: config.customWeights?.additions || benchmarkWeights?.linesOfCode?.added || 0.1,
      deletions: config.customWeights?.deletions || benchmarkWeights?.linesOfCode?.deleted || 0.05
    };
  }

  /**
   * Get WCU caps from benchmarks with config overrides
   * @private
   */
  private async getWCUCaps(config: EstimationConfig): Promise<{
    filesChanged: number;
    additions: number;
    deletions: number;
  }> {
    return {
      filesChanged: config.customCaps?.filesChanged || 100,
      additions: config.customCaps?.additions || 5000,
      deletions: config.customCaps?.deletions || 2000
    };
  }

  /**
   * Get complexity multiplier from benchmarks
   * @private
   */
  private async getComplexityMultiplier(complexity: CommitComplexity): Promise<number> {
    const multipliers = this.benchmarksService.getBenchmarkValue('workContributionUnits.weights.commitComplexity');
    return multipliers?.[complexity] || 1.0;
  }

  /**
   * Get category multiplier from benchmarks
   * @private
   */
  private async getCategoryMultiplier(category: CommitCategory): Promise<number> {
    const multipliers = this.benchmarksService.getBenchmarkValue('workContributionUnits.categoryMultipliers');
    return multipliers?.[category] || 1.0;
  }

  /**
   * Calculate keyword boost factor based on commit message analysis
   * 
   * @private
   */
  private async calculateKeywordBoost(message: string, config: EstimationConfig): Promise<number> {
    const lowerMessage = message.toLowerCase();
    
    // Default keyword boosts
    const defaultBoosts = {
      // New feature indicators
      'add': 1.2, 'implement': 1.2, 'create': 1.2, 'introduce': 1.2, 'new': 1.1,
      // Bug fix indicators  
      'fix': 1.0, 'resolve': 1.0, 'correct': 1.0, 'address': 1.0, 'patch': 0.9,
      // Refactor indicators
      'refactor': 1.1, 'restructure': 1.1, 'reorganize': 1.1, 'cleanup': 0.8,
      // Enhancement indicators
      'improve': 1.1, 'enhance': 1.1, 'optimize': 1.2, 'upgrade': 1.1,
      // Maintenance indicators
      'update': 0.9, 'maintenance': 0.7, 'chore': 0.6, 'style': 0.6,
      // Security indicators
      'security': 1.4, 'secure': 1.4, 'vulnerability': 1.3, 'auth': 1.3,
      // Documentation indicators
      'doc': 0.5, 'documentation': 0.5, 'readme': 0.4, 'comment': 0.4
    };
    
    const boosts = { ...defaultBoosts, ...config.keywordBoosts };
    
    let maxBoost = 1.0;
    for (const [keyword, boost] of Object.entries(boosts)) {
      if (lowerMessage.includes(keyword)) {
        maxBoost = Math.max(maxBoost, boost);
      }
    }
    
    return maxBoost;
  }

  /**
   * Categorize commit message to determine commit category
   * @private
   */
  private categorizeCommitMessage(message: string): CommitCategory {
    const lowerMessage = message.toLowerCase();
    
    // Feature indicators
    if (lowerMessage.match(/\b(add|implement|create|introduce|new)\b/)) {
      return 'feature';
    }
    
    // Bug fix indicators
    if (lowerMessage.match(/\b(fix|resolve|correct|address|patch|bug)\b/)) {
      return 'bugfix';
    }
    
    // Refactor indicators
    if (lowerMessage.match(/\b(refactor|restructure|reorganize|cleanup|clean)\b/)) {
      return 'refactor';
    }
    
    // Documentation indicators
    if (lowerMessage.match(/\b(doc|documentation|readme|comment|guide)\b/)) {
      return 'documentation';
    }
    
    // Test indicators
    if (lowerMessage.match(/\b(test|testing|spec|unit|integration)\b/)) {
      return 'test';
    }
    
    // Infrastructure indicators
    if (lowerMessage.match(/\b(deploy|deployment|ci|cd|build|config|configuration)\b/)) {
      return 'infrastructure';
    }
    
    // Security indicators
    if (lowerMessage.match(/\b(security|secure|auth|authentication|authorization|vulnerability)\b/)) {
      return 'security';
    }
    
    // Performance indicators
    if (lowerMessage.match(/\b(performance|optimize|optimization|speed|cache|caching)\b/)) {
      return 'performance';
    }
    
    // UI indicators
    if (lowerMessage.match(/\b(ui|interface|design|style|css|responsive|mobile)\b/)) {
      return 'ui';
    }
    
    // Default to maintenance
    return 'maintenance';
  }

  /**
   * Assess commit complexity based on changes
   * @private
   */
  private assessCommitComplexity(
    filesChanged: number,
    linesAdded: number,
    linesDeleted: number
  ): CommitComplexity {
    const totalChanges = linesAdded + linesDeleted;
    
    if (filesChanged <= 1 && totalChanges <= 10) return 'trivial';
    if (filesChanged <= 3 && totalChanges <= 50) return 'small';
    if (filesChanged <= 10 && totalChanges <= 200) return 'medium';
    if (filesChanged <= 25 && totalChanges <= 1000) return 'large';
    return 'huge';
  }

  /**
   * Calculate velocity score for commit timing analysis
   * @private
   */
  private calculateVelocityScore(
    commit: Partial<WCUCommitAnalysis>,
    previousCommitDate: Date | null
  ): number {
    if (!previousCommitDate || !commit.date) return 1.0;
    
    const hoursSincePrevious = (new Date(commit.date).getTime() - previousCommitDate.getTime()) / (1000 * 60 * 60);
    
    // Higher velocity for commits closer together (but not too close)
    if (hoursSincePrevious < 1) return 0.8; // Too rapid, might be quick fixes
    if (hoursSincePrevious < 4) return 1.2; // Good development flow
    if (hoursSincePrevious < 24) return 1.0; // Normal pace
    if (hoursSincePrevious < 168) return 0.9; // Weekly work
    return 0.7; // Slower development
  }

  /**
   * Find related commits for feature clustering
   * @private
   */
  private findRelatedCommits(
    baseCommit: WCUCommitAnalysis,
    allCommits: WCUCommitAnalysis[],
    timeWindowHours: number
  ): WCUCommitAnalysis[] {
    const baseDate = new Date(baseCommit.date);
    const relatedCommits = [baseCommit];
    
    for (const commit of allCommits) {
      if (commit.hash === baseCommit.hash) continue;
      
      const commitDate = new Date(commit.date);
      const hoursDiff = Math.abs(commitDate.getTime() - baseDate.getTime()) / (1000 * 60 * 60);
      
      // Within time window and similar category or keywords
      if (hoursDiff <= timeWindowHours) {
        const categoryMatch = commit.category === baseCommit.category;
        const keywordSimilarity = this.calculateKeywordSimilarity(baseCommit.message, commit.message);
        
        if (categoryMatch || keywordSimilarity > 0.3) {
          relatedCommits.push(commit);
        }
      }
    }
    
    // Sort by date (newest first)
    return relatedCommits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  /**
   * Calculate keyword similarity between commit messages
   * @private
   */
  private calculateKeywordSimilarity(message1: string, message2: string): number {
    const words1 = new Set(message1.toLowerCase().split(/\W+/).filter(w => w.length > 3));
    const words2 = new Set(message2.toLowerCase().split(/\W+/).filter(w => w.length > 3));
    
    const words1Array = Array.from(words1);
    const words2Array = Array.from(words2);
    const intersection = new Set(words1Array.filter(w => words2.has(w)));
    const union = new Set([...words1Array, ...words2Array]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Extract cluster keywords from related commits
   * @private
   */
  private extractClusterKeywords(commits: WCUCommitAnalysis[]): string[] {
    const wordFreq = new Map<string, number>();
    
    commits.forEach(commit => {
      const words = commit.message.toLowerCase().split(/\W+/).filter(w => w.length > 3);
      words.forEach(word => {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      });
    });
    
    // Return most frequent keywords (appearing in at least 2 commits)
    return Array.from(wordFreq.entries())
      .filter(([_, freq]) => freq >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word, _]) => word);
  }

  /**
   * Generate cluster name from commits and keywords
   * @private
   */
  private generateClusterName(commits: WCUCommitAnalysis[], keywords: string[]): string {
    if (keywords.length > 0) {
      return `${keywords[0]} ${commits[0].category}`;
    }
    return `${commits[0].category} development`;
  }

  /**
   * Determine primary category for a cluster
   * @private
   */
  private determinePrimaryCategory(commits: WCUCommitAnalysis[]): CommitCategory {
    const categoryCount = new Map<CommitCategory, number>();
    
    commits.forEach(commit => {
      categoryCount.set(commit.category, (categoryCount.get(commit.category) || 0) + 1);
    });
    
    return Array.from(categoryCount.entries())
      .sort((a, b) => b[1] - a[1])[0][0];
  }

  /**
   * Calculate cluster confidence score
   * @private
   */
  private calculateClusterConfidence(commits: WCUCommitAnalysis[], keywords: string[]): number {
    const sizeScore = Math.min(100, (commits.length / 5) * 100); // Good if 5+ commits
    const keywordScore = Math.min(100, keywords.length * 20); // Good if 5+ keywords
    const categoryConsistency = this.calculateCategoryConsistency(commits);
    
    return (sizeScore * 0.4 + keywordScore * 0.3 + categoryConsistency * 0.3) / 100;
  }

  /**
   * Calculate category consistency within a cluster
   * @private
   */
  private calculateCategoryConsistency(commits: WCUCommitAnalysis[]): number {
    const primaryCategory = this.determinePrimaryCategory(commits);
    const matchingCommits = commits.filter(c => c.category === primaryCategory).length;
    return (matchingCommits / commits.length) * 100;
  }

  /**
   * Calculate estimated effort for a feature cluster
   * @private
   */
  private async calculateClusterEffort(cluster: FeatureCluster, config: EstimationConfig): Promise<number> {
    const baseHoursPerWCU = 3.2;
    const categoryMultiplier = await this.getCategoryMultiplier(cluster.primaryCategory);
    const confidenceAdjustment = cluster.confidence;
    
    return cluster.totalWCU * baseHoursPerWCU * categoryMultiplier * confidenceAdjustment;
  }

  /**
   * Calculate blended hourly rate
   * @private
   */
  private async calculateBlendedRate(config: EstimationConfig): Promise<number> {
    const rates = this.benchmarksService.getBenchmarkValue('baseRates.globalAverages');
    const regionalMultiplier = this.benchmarksService.getBenchmarkValue(
      `baseRates.regionalMultipliers.${config.region || 'northAmerica'}`
    ) || 1.0;
    
    // Assume mid-level developer average
    const baseRate = rates?.midLevelDeveloper || 75;
    return baseRate * regionalMultiplier;
  }

  /**
   * Calculate average commits per day
   * @private
   */
  private calculateAverageCommitsPerDay(commits: WCUCommitAnalysis[]): number {
    if (commits.length === 0) return 0;
    
    const timeSpanDays = this.calculateTimeSpanDays(commits);
    return timeSpanDays > 0 ? commits.length / timeSpanDays : 0;
  }

  /**
   * Estimate hours per commit from patterns
   * @private
   */
  private estimateHoursPerCommit(commits: WCUCommitAnalysis[]): number {
    // Base estimation on commit complexity and velocity
    const avgComplexity = commits.reduce((sum, c) => {
      const complexityScore = { trivial: 1, small: 2, medium: 3, large: 4, huge: 5 }[c.complexity];
      return sum + complexityScore;
    }, 0) / commits.length;
    
    const avgVelocity = commits.reduce((sum, c) => sum + c.velocityScore, 0) / commits.length;
    
    // Base hours per commit adjusted by complexity and velocity
    return 2.5 * avgComplexity * (2 - avgVelocity); // Higher complexity = more hours, higher velocity = fewer hours
  }

  /**
   * Calculate estimation confidence
   * @private
   */
  private calculateEstimationConfidence(commits: WCUCommitAnalysis[], clusters: FeatureCluster[]): number {
    const dataQuality = Math.min(100, (commits.length / 20) * 100);
    const clusteringSuccess = clusters.length > 0 ? (clusters.length / Math.ceil(commits.length / 5)) * 100 : 50;
    const consistencyScore = this.calculateConsistencyScore(commits);
    
    return (dataQuality * 0.4 + clusteringSuccess * 0.3 + consistencyScore * 0.3) / 100;
  }

  /**
   * Calculate consistency score across commits
   * @private
   */
  private calculateConsistencyScore(commits: WCUCommitAnalysis[]): number {
    if (commits.length === 0) return 0;
    
    const avgWCU = commits.reduce((sum, c) => sum + c.adjustedWCU, 0) / commits.length;
    const variance = commits.reduce((sum, c) => sum + Math.pow(c.adjustedWCU - avgWCU, 2), 0) / commits.length;
    const stdDev = Math.sqrt(variance);
    
    return Math.max(0, 100 - (stdDev / avgWCU) * 100);
  }

  /**
   * Generate category breakdown
   * @private
   */
  private generateCategoryBreakdown(commits: WCUCommitAnalysis[]): Record<CommitCategory, {
    commits: number;
    wcu: number;
    hours: number;
    cost: number;
  }> {
    const breakdown: Record<string, any> = {};
    const categories: CommitCategory[] = ['feature', 'bugfix', 'refactor', 'documentation', 'test', 'maintenance', 'infrastructure', 'security', 'performance', 'ui'];
    
    categories.forEach(category => {
      const categoryCommits = commits.filter(c => c.category === category);
      const totalWCU = categoryCommits.reduce((sum, c) => sum + c.adjustedWCU, 0);
      const estimatedHours = totalWCU * 3.2; // Base hours per WCU
      const cost = estimatedHours * 75; // Average rate
      
      breakdown[category] = {
        commits: categoryCommits.length,
        wcu: totalWCU,
        hours: estimatedHours,
        cost: cost
      };
    });
    
    return breakdown as Record<CommitCategory, any>;
  }

  /**
   * Calculate velocity metrics
   * @private
   */
  private calculateVelocityMetrics(commits: WCUCommitAnalysis[]): {
    commitsPerDay: number;
    wcuPerDay: number;
    peakPeriods: Array<{
      startDate: string;
      endDate: string;
      avgCommitsPerDay: number;
      avgWCUPerDay: number;
    }>;
  } {
    const timeSpanDays = this.calculateTimeSpanDays(commits);
    const totalWCU = commits.reduce((sum, c) => sum + c.adjustedWCU, 0);
    
    return {
      commitsPerDay: timeSpanDays > 0 ? commits.length / timeSpanDays : 0,
      wcuPerDay: timeSpanDays > 0 ? totalWCU / timeSpanDays : 0,
      peakPeriods: this.identifyPeakPeriods(commits)
    };
  }

  /**
   * Identify peak productivity periods
   * @private
   */
  private identifyPeakPeriods(commits: WCUCommitAnalysis[]): Array<{
    startDate: string;
    endDate: string;
    avgCommitsPerDay: number;
    avgWCUPerDay: number;
  }> {
    // Group commits by week and identify high-activity periods
    const weeklyGroups = new Map<string, WCUCommitAnalysis[]>();
    
    commits.forEach(commit => {
      const date = new Date(commit.date);
      const weekKey = `${date.getFullYear()}-W${Math.ceil(date.getDate() / 7)}`;
      if (!weeklyGroups.has(weekKey)) {
        weeklyGroups.set(weekKey, []);
      }
      weeklyGroups.get(weekKey)!.push(commit);
    });
    
    const avgCommitsPerWeek = commits.length / weeklyGroups.size;
    const peakPeriods: Array<any> = [];
    
    weeklyGroups.forEach((weekCommits, weekKey) => {
      if (weekCommits.length > avgCommitsPerWeek * 1.5) { // 50% above average
        const sortedCommits = weekCommits.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const totalWCU = weekCommits.reduce((sum, c) => sum + c.adjustedWCU, 0);
        
        peakPeriods.push({
          startDate: sortedCommits[0].date,
          endDate: sortedCommits[sortedCommits.length - 1].date,
          avgCommitsPerDay: weekCommits.length / 7,
          avgWCUPerDay: totalWCU / 7
        });
      }
    });
    
    return peakPeriods;
  }

  /**
   * Calculate time span in days
   * @private
   */
  private calculateTimeSpanDays(commits: WCUCommitAnalysis[]): number {
    if (commits.length === 0) return 0;
    
    const dates = commits.map(c => new Date(c.date).getTime()).sort((a, b) => a - b);
    const spanMs = dates[dates.length - 1] - dates[0];
    return Math.max(1, spanMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Calculate date range string
   * @private
   */
  private calculateDateRange(commits: WCUCommitAnalysis[]): string {
    if (commits.length === 0) return 'No commits';
    
    const dates = commits.map(c => c.date).sort();
    return `${dates[0]} to ${dates[dates.length - 1]}`;
  }
}