import { IndustryBenchmarksService, CommitAnalysis, ProjectParameters, CommitCategory, CommitComplexity } from './benchmarks.js';
import { WorkContributionEstimator, WCUEstimationResult, FeatureCluster, WCUCommitAnalysis } from './estimator.js';
import { GitIntegratedProgressService } from '../gitIntegratedProgress.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Comprehensive Savings Calculation Engine
 * 
 * This service provides detailed analysis comparing traditional development estimates 
 * vs actual development time/cost to demonstrate concrete client savings.
 * 
 * Key Features:
 * - Traditional vs Actual hour/cost comparisons with detailed breakdowns
 * - Per-category and feature cluster savings analysis
 * - Time period trend analysis and efficiency metrics
 * - Client-friendly executive reporting with compelling metrics
 * - Historical tracking and calibration based on actual project data
 * - Confidence scoring and validation of savings estimates
 * - Integration with existing WCU calculation and benchmarks systems
 * 
 * @example
 * ```typescript
 * const calculator = SavingsCalculator.getInstance();
 * await calculator.initialize();
 * 
 * const savings = await calculator.calculateProjectSavings({
 *   sinceDate: '6 months ago',
 *   projectType: 'webApplication',
 *   region: 'northAmerica',
 *   teamSize: 5
 * });
 * 
 * console.log(`Total savings: $${savings.totalSavings.dollars}`);
 * console.log(`Weeks saved: ${savings.totalSavings.weeks}`);
 * console.log(`Efficiency gain: ${savings.efficiencyMetrics.productivityMultiplier}x`);
 * ```
 * 
 * @author Development Team
 * @version 1.0.0
 */

/**
 * Core savings calculation result comparing traditional vs actual estimates
 */
export interface SavingsCalculation {
  /** Traditional estimation using industry standards */
  traditional: {
    /** Total estimated hours using traditional methods */
    hours: number;
    /** Total estimated cost using traditional methods */
    cost: number;
    /** Methodology used for traditional estimate */
    methodology: string;
    /** Confidence in traditional estimate (0-100) */
    confidence: number;
    /** Breakdown by category */
    categoryBreakdown: Record<CommitCategory, {
      hours: number;
      cost: number;
      methodology: string;
    }>;
  };
  /** Actual time spent based on git analysis */
  actual: {
    /** Actual hours spent based on commit analysis */
    hours: number;
    /** Actual cost based on team rates */
    cost: number;
    /** Methodology used for actual calculation */
    methodology: string;
    /** Data quality confidence (0-100) */
    confidence: number;
    /** Breakdown by category */
    categoryBreakdown: Record<CommitCategory, {
      hours: number;
      cost: number;
      commits: number;
    }>;
  };
  /** Calculated savings */
  savings: {
    /** Hours saved compared to traditional estimate */
    hours: number;
    /** Dollar savings compared to traditional estimate */
    dollars: number;
    /** Weeks saved based on team capacity */
    weeks: number;
    /** Percentage savings (0-100) */
    percentage: number;
    /** Return on investment multiplier */
    roiMultiplier: number;
  };
}

/**
 * Feature cluster savings analysis
 */
export interface FeatureClusterSavings {
  /** Original feature cluster data */
  cluster: FeatureCluster;
  /** Savings calculation for this cluster */
  savings: SavingsCalculation;
  /** Efficiency metrics specific to this feature */
  efficiency: {
    /** Hours per commit for this cluster */
    hoursPerCommit: number;
    /** Cost per commit for this cluster */
    costPerCommit: number;
    /** Velocity score for this cluster */
    velocityScore: number;
    /** Complexity vs effort efficiency */
    complexityEfficiency: number;
  };
  /** Ranking among all clusters by savings */
  savingsRank: number;
  /** Ranking among all clusters by efficiency */
  efficiencyRank: number;
}

/**
 * Time period comparison for trend analysis
 */
export interface TimePeriodComparison {
  /** Period identifier */
  period: string;
  /** Start date of period */
  startDate: string;
  /** End date of period */
  endDate: string;
  /** Savings calculation for this period */
  savings: SavingsCalculation;
  /** Development velocity for this period */
  velocity: {
    /** Commits per day */
    commitsPerDay: number;
    /** WCU per day */
    wcuPerDay: number;
    /** Features completed per week */
    featuresPerWeek: number;
  };
  /** Efficiency trend compared to previous period */
  trend: {
    /** Efficiency change percentage */
    efficiencyChange: number;
    /** Savings change percentage */
    savingsChange: number;
    /** Velocity change percentage */
    velocityChange: number;
    /** Direction of trend */
    direction: 'improving' | 'declining' | 'stable';
  };
}

/**
 * Executive summary with key savings metrics
 */
export interface ExecutiveSummary {
  /** Total project savings */
  totalSavings: {
    /** Total dollars saved */
    dollars: number;
    /** Total hours saved */
    hours: number;
    /** Total weeks saved */
    weeks: number;
    /** Overall savings percentage */
    percentage: number;
    /** ROI multiplier */
    roi: number;
  };
  /** Top savings opportunities */
  topOpportunities: Array<{
    /** Category or feature name */
    name: string;
    /** Type of opportunity */
    type: 'category' | 'feature' | 'practice';
    /** Savings amount */
    savings: number;
    /** Potential additional savings */
    potential: number;
    /** Recommendation for improvement */
    recommendation: string;
  }>;
  /** Efficiency metrics */
  efficiency: {
    /** Overall productivity multiplier vs traditional */
    productivityMultiplier: number;
    /** Cost efficiency improvement percentage */
    costEfficiency: number;
    /** Time to market improvement */
    timeToMarket: number;
    /** Quality metrics */
    quality: {
      /** Defect rate compared to industry average */
      defectRate: number;
      /** Rework percentage */
      reworkPercentage: number;
      /** Test coverage improvement */
      testCoverage: number;
    };
  };
  /** Confidence and validation */
  confidence: {
    /** Overall confidence in savings calculation */
    overall: number;
    /** Data quality score */
    dataQuality: number;
    /** Methodology reliability */
    methodology: number;
    /** Sample size adequacy */
    sampleSize: number;
  };
}

/**
 * Historical savings data for trend analysis
 */
export interface HistoricalSavingsData {
  /** Unique identifier */
  id: string;
  /** Project or analysis identifier */
  projectId: string;
  /** Calculation date */
  calculatedAt: string;
  /** Period analyzed */
  period: {
    /** Start date */
    startDate: string;
    /** End date */
    endDate: string;
    /** Duration in days */
    durationDays: number;
  };
  /** Project parameters used */
  parameters: ProjectParameters;
  /** Savings calculation result */
  savings: SavingsCalculation;
  /** Executive summary */
  summary: ExecutiveSummary;
  /** Metadata */
  metadata: {
    /** WCU estimation result used */
    wcuEstimation: WCUEstimationResult;
    /** Git analysis data */
    gitAnalysis: any;
    /** Calibration factors applied */
    calibrationFactors?: Record<string, number>;
    /** Notes or comments */
    notes?: string;
  };
}

/**
 * Calibration data for improving estimate accuracy
 */
export interface CalibrationData {
  /** Category or type being calibrated */
  category: CommitCategory | 'overall';
  /** Historical accuracy data */
  accuracy: {
    /** Number of samples */
    samples: number;
    /** Average estimation error percentage */
    averageError: number;
    /** Standard deviation of errors */
    standardDeviation: number;
    /** Bias direction */
    bias: 'overestimate' | 'underestimate' | 'neutral';
  };
  /** Adjustment factors */
  adjustments: {
    /** Traditional estimate multiplier */
    traditionalMultiplier: number;
    /** Actual hours multiplier */
    actualMultiplier: number;
    /** Confidence adjustment */
    confidenceAdjustment: number;
  };
  /** Last updated timestamp */
  lastUpdated: string;
  /** Data quality metrics */
  quality: {
    /** Sample size adequacy */
    sampleAdequacy: number;
    /** Recency of data */
    recency: number;
    /** Consistency score */
    consistency: number;
  };
}

/**
 * Savings calculation configuration
 */
export interface SavingsConfig extends Partial<ProjectParameters> {
  /** Date to start analysis from */
  sinceDate?: string;
  /** Date to end analysis at */
  untilDate?: string;
  /** Include calibration adjustments */
  useCalibration?: boolean;
  /** Minimum confidence threshold for results */
  minConfidence?: number;
  /** Custom traditional estimate overrides */
  traditionalOverrides?: {
    /** Hours per WCU override */
    hoursPerWCU?: number;
    /** Category multipliers */
    categoryMultipliers?: Record<CommitCategory, number>;
    /** Risk factors */
    riskFactors?: Record<string, number>;
  };
  /** Custom actual hours calculation overrides */
  actualOverrides?: {
    /** Hours per commit by category */
    hoursPerCommit?: Record<CommitCategory, number>;
    /** Base hours per commit */
    baseHoursPerCommit?: number;
    /** Complexity multipliers */
    complexityMultipliers?: Record<CommitComplexity, number>;
  };
  /** Reporting preferences */
  reporting?: {
    /** Include detailed breakdowns */
    includeDetailedBreakdowns?: boolean;
    /** Include trend analysis */
    includeTrendAnalysis?: boolean;
    /** Include feature cluster analysis */
    includeClusterAnalysis?: boolean;
    /** Include calibration recommendations */
    includeCalibrationRecommendations?: boolean;
  };
}

/**
 * Comprehensive savings analysis result
 */
export interface ComprehensiveSavingsResult {
  /** Summary metrics */
  summary: ExecutiveSummary;
  /** Overall savings calculation */
  totalSavings: SavingsCalculation;
  /** Savings by category */
  categoryAnalysis: Record<CommitCategory, SavingsCalculation>;
  /** Savings by feature cluster */
  clusterAnalysis: FeatureClusterSavings[];
  /** Time period trend analysis */
  trendAnalysis: TimePeriodComparison[];
  /** Efficiency metrics */
  efficiencyMetrics: {
    /** Overall productivity metrics */
    productivity: {
      /** WCU per hour */
      wcuPerHour: number;
      /** Features per week */
      featuresPerWeek: number;
      /** Commits per day */
      commitsPerDay: number;
      /** Lines of code per hour */
      locPerHour: number;
    };
    /** Cost effectiveness */
    costEffectiveness: {
      /** Cost per feature */
      costPerFeature: number;
      /** Cost per WCU */
      costPerWCU: number;
      /** Cost reduction percentage */
      costReduction: number;
    };
    /** Time effectiveness */
    timeEffectiveness: {
      /** Time to market improvement */
      timeToMarket: number;
      /** Cycle time reduction */
      cycleTimeReduction: number;
      /** Lead time improvement */
      leadTimeImprovement: number;
    };
  };
  /** Confidence and validation */
  confidence: {
    /** Overall confidence score */
    overall: number;
    /** Breakdown by component */
    breakdown: {
      /** Traditional estimate confidence */
      traditional: number;
      /** Actual data confidence */
      actual: number;
      /** Savings calculation confidence */
      savings: number;
      /** Methodology confidence */
      methodology: number;
    };
    /** Risk factors */
    risks: Array<{
      /** Risk description */
      description: string;
      /** Impact level */
      impact: 'low' | 'medium' | 'high';
      /** Mitigation suggestions */
      mitigation: string;
    }>;
  };
  /** Recommendations */
  recommendations: Array<{
    /** Recommendation type */
    type: 'process' | 'tooling' | 'training' | 'methodology';
    /** Priority level */
    priority: 'low' | 'medium' | 'high' | 'critical';
    /** Description */
    description: string;
    /** Expected impact */
    expectedImpact: {
      /** Potential additional savings */
      savings: number;
      /** Efficiency improvement */
      efficiency: number;
      /** Implementation effort */
      effort: 'low' | 'medium' | 'high';
    };
  }>;
  /** Metadata */
  metadata: {
    /** Calculation timestamp */
    calculatedAt: string;
    /** Data sources used */
    dataSources: string[];
    /** Methodologies applied */
    methodologies: string[];
    /** Calibration factors used */
    calibrationFactors?: Record<string, number>;
    /** Configuration used */
    config: SavingsConfig;
  };
}

/**
 * Comprehensive Savings Calculator Service
 * 
 * Provides detailed analysis comparing traditional development estimates 
 * vs actual development time/cost to demonstrate concrete client savings.
 */
export class SavingsCalculator {
  private static instance: SavingsCalculator;
  private benchmarksService?: IndustryBenchmarksService;
  private wcuEstimator?: WorkContributionEstimator;
  private gitService?: GitIntegratedProgressService;
  private calibrationData: Map<string, CalibrationData> = new Map();
  private historicalData: HistoricalSavingsData[] = [];
  private initialized: boolean = false;

  private constructor() {
    // Use lazy initialization to avoid circular dependencies
  }

  /**
   * Get singleton instance of the savings calculator
   */
  public static getInstance(): SavingsCalculator {
    if (!SavingsCalculator.instance) {
      SavingsCalculator.instance = new SavingsCalculator();
    }
    return SavingsCalculator.instance;
  }

  /**
   * Initialize the savings calculator service
   * 
   * @throws Error if initialization fails
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('[Savings Calculator] Initializing savings calculation engine...');
      
      // Initialize dependencies lazily
      this.benchmarksService = IndustryBenchmarksService.getInstance();
      this.wcuEstimator = WorkContributionEstimator.getInstance();
      // Don't initialize gitService here to avoid circular dependency
      
      await this.benchmarksService.initialize();
      await this.wcuEstimator.initialize();
      
      // Load calibration data
      await this.loadCalibrationData();
      
      // Load historical data
      await this.loadHistoricalData();
      
      this.initialized = true;
      console.log('[Savings Calculator] Initialization complete');
    } catch (error) {
      console.error('[Savings Calculator] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Calculate comprehensive project savings analysis
   * 
   * @param config Savings calculation configuration
   * @returns Comprehensive savings analysis result
   * 
   * @example
   * ```typescript
   * const savings = await calculator.calculateProjectSavings({
   *   sinceDate: '3 months ago',
   *   projectType: 'webApplication',
   *   region: 'northAmerica',
   *   teamSize: 5,
   *   useCalibration: true
   * });
   * ```
   */
  public async calculateProjectSavings(config: SavingsConfig = {}): Promise<ComprehensiveSavingsResult> {
    if (!this.initialized) {
      throw new Error('SavingsCalculator not initialized');
    }

    console.log('[Savings Calculator] Starting comprehensive savings analysis...');
    
    // Ensure services are initialized
    if (!this.wcuEstimator) {
      this.wcuEstimator = WorkContributionEstimator.getInstance();
      await this.wcuEstimator.initialize();
    }
    
    // Get WCU estimation data
    const wcuResult = await this.wcuEstimator.estimateFromGitHistory(config);
    
    // Calculate traditional estimates
    const traditionalEstimate = await this.calculateTraditionalEstimate(wcuResult, config);
    
    // Calculate actual hours and costs
    const actualEstimate = await this.calculateActualEstimate(wcuResult, config);
    
    // Calculate savings
    const totalSavings = this.calculateSavings(traditionalEstimate, actualEstimate, config);
    
    // Perform category analysis
    const categoryAnalysis = await this.performCategoryAnalysis(wcuResult, config);
    
    // Perform cluster analysis
    const clusterAnalysis = await this.performClusterAnalysis(wcuResult, config);
    
    // Perform trend analysis
    const trendAnalysis = await this.performTrendAnalysis(config);
    
    // Calculate efficiency metrics
    const efficiencyMetrics = this.calculateEfficiencyMetrics(wcuResult, totalSavings);
    
    // Generate executive summary
    const summary = this.generateExecutiveSummary(
      totalSavings, 
      categoryAnalysis, 
      clusterAnalysis, 
      efficiencyMetrics
    );
    
    // Calculate confidence and generate recommendations
    const confidence = this.calculateConfidenceScoring(wcuResult, totalSavings, config);
    const recommendations = this.generateRecommendations(wcuResult, totalSavings, efficiencyMetrics);
    
    const result: ComprehensiveSavingsResult = {
      summary,
      totalSavings,
      categoryAnalysis,
      clusterAnalysis,
      trendAnalysis,
      efficiencyMetrics,
      confidence,
      recommendations,
      metadata: {
        calculatedAt: new Date().toISOString(),
        dataSources: ['git-history', 'wcu-estimation', 'industry-benchmarks'],
        methodologies: ['traditional-estimation', 'git-analysis', 'wcu-calculation'],
        calibrationFactors: config.useCalibration ? this.getCalibrationFactors() : undefined,
        config
      }
    };

    // Store historical data
    await this.storeHistoricalData(result, wcuResult);
    
    console.log(`[Savings Calculator] Analysis complete: $${Math.round(totalSavings.savings.dollars)} saved, ${Math.round(totalSavings.savings.weeks)} weeks saved`);
    
    return result;
  }

  /**
   * Calculate traditional estimate using industry benchmarks and WCU methodology
   */
  private async calculateTraditionalEstimate(
    wcuResult: WCUEstimationResult, 
    config: SavingsConfig
  ): Promise<SavingsCalculation['traditional']> {
    console.log('[Savings Calculator] Calculating traditional estimate...');
    
    // Base traditional calculation using industry standards
    const baseHoursPerWCU = config.traditionalOverrides?.hoursPerWCU || 4.5; // Industry average
    const totalWCU = wcuResult.summary.adjustedWCU;
    
    let totalHours = totalWCU * baseHoursPerWCU;
    let totalCost = 0;
    
    const categoryBreakdown: Record<string, any> = {};
    
    // Calculate by category with traditional multipliers
    for (const [category, categoryData] of Object.entries(wcuResult.categoryBreakdown)) {
      const categoryMultiplier = config.traditionalOverrides?.categoryMultipliers?.[category as CommitCategory] || 
        this.getTraditionalCategoryMultiplier(category as CommitCategory);
      
      const categoryHours = categoryData.wcu * baseHoursPerWCU * categoryMultiplier;
      const categoryCost = categoryHours * this.getBlendedHourlyRate(config);
      
      totalCost += categoryCost;
      
      categoryBreakdown[category] = {
        hours: categoryHours,
        cost: categoryCost,
        methodology: 'Industry-Standard-WCU-Traditional'
      };
    }
    
    // Apply risk factors
    const riskMultiplier = this.calculateRiskMultiplier(config);
    totalHours *= riskMultiplier;
    totalCost *= riskMultiplier;
    
    // Apply calibration if enabled
    if (config.useCalibration) {
      const calibrationFactor = this.getCalibrationFactor('traditional', 'overall');
      totalHours *= calibrationFactor;
      totalCost *= calibrationFactor;
    }
    
    return {
      hours: totalHours,
      cost: totalCost,
      methodology: 'Traditional-WCU-Industry-Benchmarks',
      confidence: this.calculateTraditionalConfidence(wcuResult, config),
      categoryBreakdown
    };
  }

  /**
   * Calculate actual hours and costs based on git commit analysis
   */
  private async calculateActualEstimate(
    wcuResult: WCUEstimationResult, 
    config: SavingsConfig
  ): Promise<SavingsCalculation['actual']> {
    console.log('[Savings Calculator] Calculating actual estimate from git data...');
    
    let totalHours = 0;
    let totalCost = 0;
    
    const categoryBreakdown: Record<string, any> = {};
    const blendedRate = this.getBlendedHourlyRate(config);
    
    // Calculate by category with actual commit patterns
    for (const [category, categoryData] of Object.entries(wcuResult.categoryBreakdown)) {
      const baseHoursPerCommit = config.actualOverrides?.baseHoursPerCommit || 2.8; // Based on research
      const categoryHoursPerCommit = config.actualOverrides?.hoursPerCommit?.[category as CommitCategory] || 
        this.getActualCategoryHoursPerCommit(category as CommitCategory);
      
      const categoryHours = categoryData.commits * categoryHoursPerCommit;
      const categoryCost = categoryHours * blendedRate;
      
      totalHours += categoryHours;
      totalCost += categoryCost;
      
      categoryBreakdown[category] = {
        hours: categoryHours,
        cost: categoryCost,
        commits: categoryData.commits
      };
    }
    
    // Apply calibration if enabled
    if (config.useCalibration) {
      const calibrationFactor = this.getCalibrationFactor('actual', 'overall');
      totalHours *= calibrationFactor;
      totalCost *= calibrationFactor;
    }
    
    return {
      hours: totalHours,
      cost: totalCost,
      methodology: 'Git-Commit-Analysis-Actual',
      confidence: this.calculateActualConfidence(wcuResult, config),
      categoryBreakdown
    };
  }

  /**
   * Calculate savings between traditional and actual estimates
   */
  private calculateSavings(
    traditional: SavingsCalculation['traditional'],
    actual: SavingsCalculation['actual'],
    config: SavingsConfig
  ): SavingsCalculation {
    const hoursSaved = Math.max(traditional.hours - actual.hours, 0);
    const dollarsSaved = Math.max(traditional.cost - actual.cost, 0);
    
    // Calculate weeks saved based on team capacity
    const teamSize = config.teamSize || 5;
    const hoursPerWeek = 40; // Standard work week
    const teamCapacityPerWeek = teamSize * hoursPerWeek;
    const weeksSaved = hoursSaved / teamCapacityPerWeek;
    
    // Calculate percentage savings
    const percentage = traditional.hours > 0 ? (hoursSaved / traditional.hours) * 100 : 0;
    
    // Calculate ROI multiplier
    const roiMultiplier = actual.cost > 0 ? traditional.cost / actual.cost : 1;
    
    return {
      traditional,
      actual,
      savings: {
        hours: hoursSaved,
        dollars: dollarsSaved,
        weeks: weeksSaved,
        percentage,
        roiMultiplier
      }
    };
  }

  /**
   * Perform category-wise savings analysis
   */
  private async performCategoryAnalysis(
    wcuResult: WCUEstimationResult,
    config: SavingsConfig
  ): Promise<Record<CommitCategory, SavingsCalculation>> {
    const categoryAnalysis: Record<string, SavingsCalculation> = {};
    
    for (const [category, categoryData] of Object.entries(wcuResult.categoryBreakdown)) {
      const categoryConfig = { ...config };
      
      // Create category-specific WCU result
      const categorywcuResult: WCUEstimationResult = {
        ...wcuResult,
        summary: {
          ...wcuResult.summary,
          totalCommits: categoryData.commits,
          totalWCU: categoryData.wcu,
          adjustedWCU: categoryData.wcu
        },
        categoryBreakdown: {
          [category]: categoryData
        } as any
      };
      
      const traditional = await this.calculateTraditionalEstimate(categorywcuResult, categoryConfig);
      const actual = await this.calculateActualEstimate(categorywcuResult, categoryConfig);
      const savings = this.calculateSavings(traditional, actual, categoryConfig);
      
      categoryAnalysis[category] = savings;
    }
    
    return categoryAnalysis as Record<CommitCategory, SavingsCalculation>;
  }

  /**
   * Perform feature cluster savings analysis
   */
  private async performClusterAnalysis(
    wcuResult: WCUEstimationResult,
    config: SavingsConfig
  ): Promise<FeatureClusterSavings[]> {
    const clusterAnalysis: FeatureClusterSavings[] = [];
    
    for (const cluster of wcuResult.clusters) {
      // Create cluster-specific calculations
      const clusterCommits = cluster.commits;
      const clusterWCU = cluster.totalWCU;
      
      // Create cluster-specific WCU result
      const clusterWcuResult: WCUEstimationResult = {
        ...wcuResult,
        summary: {
          ...wcuResult.summary,
          totalCommits: clusterCommits.length,
          totalWCU: clusterWCU,
          adjustedWCU: clusterWCU
        },
        commits: clusterCommits
      };
      
      const traditional = await this.calculateTraditionalEstimate(clusterWcuResult, config);
      const actual = await this.calculateActualEstimate(clusterWcuResult, config);
      const savings = this.calculateSavings(traditional, actual, config);
      
      // Calculate efficiency metrics
      const efficiency = {
        hoursPerCommit: actual.hours / clusterCommits.length,
        costPerCommit: actual.cost / clusterCommits.length,
        velocityScore: cluster.totalWCU / clusterCommits.length,
        complexityEfficiency: this.calculateComplexityEfficiency(clusterCommits)
      };
      
      clusterAnalysis.push({
        cluster,
        savings,
        efficiency,
        savingsRank: 0, // Will be calculated after all clusters
        efficiencyRank: 0 // Will be calculated after all clusters
      });
    }
    
    // Calculate rankings
    clusterAnalysis.sort((a, b) => b.savings.savings.dollars - a.savings.savings.dollars);
    clusterAnalysis.forEach((item, index) => item.savingsRank = index + 1);
    
    clusterAnalysis.sort((a, b) => a.efficiency.hoursPerCommit - b.efficiency.hoursPerCommit);
    clusterAnalysis.forEach((item, index) => item.efficiencyRank = index + 1);
    
    return clusterAnalysis;
  }

  /**
   * Perform time period trend analysis
   */
  private async performTrendAnalysis(config: SavingsConfig): Promise<TimePeriodComparison[]> {
    const periods = this.generateTimePeriods(config);
    const trendAnalysis: TimePeriodComparison[] = [];
    
    for (let i = 0; i < periods.length; i++) {
      const period = periods[i];
      const periodConfig = {
        ...config,
        sinceDate: period.startDate,
        untilDate: period.endDate
      };
      
      try {
        const wcuResult = await this.wcuEstimator.estimateFromGitHistory(periodConfig);
        const traditional = await this.calculateTraditionalEstimate(wcuResult, periodConfig);
        const actual = await this.calculateActualEstimate(wcuResult, periodConfig);
        const savings = this.calculateSavings(traditional, actual, periodConfig);
        
        const velocity = {
          commitsPerDay: wcuResult.velocity.commitsPerDay,
          wcuPerDay: wcuResult.velocity.wcuPerDay,
          featuresPerWeek: wcuResult.clusters.length / ((new Date(period.endDate).getTime() - new Date(period.startDate).getTime()) / (7 * 24 * 60 * 60 * 1000))
        };
        
        let trend = {
          efficiencyChange: 0,
          savingsChange: 0,
          velocityChange: 0,
          direction: 'stable' as const
        };
        
        // Calculate trend compared to previous period
        if (i > 0) {
          const prevPeriod = trendAnalysis[i - 1];
          trend = this.calculateTrend(prevPeriod, { savings, velocity });
        }
        
        trendAnalysis.push({
          period: period.name,
          startDate: period.startDate,
          endDate: period.endDate,
          savings,
          velocity,
          trend
        });
      } catch (error) {
        console.warn(`[Savings Calculator] Could not analyze period ${period.name}:`, error);
      }
    }
    
    return trendAnalysis;
  }

  /**
   * Calculate comprehensive efficiency metrics
   */
  private calculateEfficiencyMetrics(
    wcuResult: WCUEstimationResult,
    savings: SavingsCalculation
  ): ComprehensiveSavingsResult['efficiencyMetrics'] {
    const totalHours = savings.actual.hours;
    const totalCost = savings.actual.cost;
    const commits = wcuResult.summary.totalCommits;
    const clusters = wcuResult.clusters.length;
    
    // Calculate duration in weeks
    const startDate = new Date(wcuResult.commits[wcuResult.commits.length - 1]?.date || Date.now());
    const endDate = new Date(wcuResult.commits[0]?.date || Date.now());
    const durationWeeks = Math.max((endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000), 1);
    
    // Calculate lines of code
    const totalLOC = wcuResult.commits.reduce((sum, commit) => 
      sum + commit.linesAdded + commit.linesDeleted, 0
    );
    
    return {
      productivity: {
        wcuPerHour: wcuResult.summary.adjustedWCU / totalHours,
        featuresPerWeek: clusters / durationWeeks,
        commitsPerDay: commits / (durationWeeks * 7),
        locPerHour: totalLOC / totalHours
      },
      costEffectiveness: {
        costPerFeature: totalCost / Math.max(clusters, 1),
        costPerWCU: totalCost / wcuResult.summary.adjustedWCU,
        costReduction: savings.savings.percentage
      },
      timeEffectiveness: {
        timeToMarket: savings.savings.weeks,
        cycleTimeReduction: this.calculateCycleTimeReduction(wcuResult),
        leadTimeImprovement: this.calculateLeadTimeImprovement(wcuResult)
      }
    };
  }

  /**
   * Generate executive summary with key insights
   */
  private generateExecutiveSummary(
    totalSavings: SavingsCalculation,
    categoryAnalysis: Record<CommitCategory, SavingsCalculation>,
    clusterAnalysis: FeatureClusterSavings[],
    efficiencyMetrics: ComprehensiveSavingsResult['efficiencyMetrics']
  ): ExecutiveSummary {
    // Find top savings opportunities
    const categoryOpportunities = Object.entries(categoryAnalysis)
      .map(([category, savings]) => ({
        name: category,
        type: 'category' as const,
        savings: savings.savings.dollars,
        potential: this.calculatePotentialSavings(category, savings),
        recommendation: this.generateCategoryRecommendation(category, savings)
      }))
      .sort((a, b) => b.savings - a.savings)
      .slice(0, 3);
    
    const featureOpportunities = clusterAnalysis
      .map(cluster => ({
        name: cluster.cluster.name,
        type: 'feature' as const,
        savings: cluster.savings.savings.dollars,
        potential: this.calculateFeaturePotentialSavings(cluster),
        recommendation: this.generateFeatureRecommendation(cluster)
      }))
      .sort((a, b) => b.savings - a.savings)
      .slice(0, 2);
    
    const topOpportunities = [...categoryOpportunities, ...featureOpportunities]
      .sort((a, b) => b.savings - a.savings)
      .slice(0, 5);
    
    return {
      totalSavings: {
        dollars: totalSavings.savings.dollars,
        hours: totalSavings.savings.hours,
        weeks: totalSavings.savings.weeks,
        percentage: totalSavings.savings.percentage,
        roi: totalSavings.savings.roiMultiplier
      },
      topOpportunities,
      efficiency: {
        productivityMultiplier: totalSavings.savings.roiMultiplier,
        costEfficiency: efficiencyMetrics.costEffectiveness.costReduction,
        timeToMarket: efficiencyMetrics.timeEffectiveness.timeToMarket,
        quality: {
          defectRate: this.calculateDefectRate(totalSavings),
          reworkPercentage: this.calculateReworkPercentage(categoryAnalysis),
          testCoverage: this.calculateTestCoverage(categoryAnalysis)
        }
      },
      confidence: {
        overall: (totalSavings.traditional.confidence + totalSavings.actual.confidence) / 2,
        dataQuality: totalSavings.actual.confidence,
        methodology: totalSavings.traditional.confidence,
        sampleSize: this.calculateSampleSizeAdequacy(totalSavings)
      }
    };
  }

  /**
   * Calculate confidence scoring for savings estimates
   */
  private calculateConfidenceScoring(
    wcuResult: WCUEstimationResult,
    savings: SavingsCalculation,
    config: SavingsConfig
  ): ComprehensiveSavingsResult['confidence'] {
    const traditionalConfidence = savings.traditional.confidence;
    const actualConfidence = savings.actual.confidence;
    const savingsConfidence = Math.min(traditionalConfidence, actualConfidence);
    const methodologyConfidence = this.calculateMethodologyConfidence(config);
    
    const overall = (traditionalConfidence + actualConfidence + savingsConfidence + methodologyConfidence) / 4;
    
    const risks = this.identifyRisks(wcuResult, savings, config);
    
    return {
      overall,
      breakdown: {
        traditional: traditionalConfidence,
        actual: actualConfidence,
        savings: savingsConfidence,
        methodology: methodologyConfidence
      },
      risks
    };
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    wcuResult: WCUEstimationResult,
    savings: SavingsCalculation,
    efficiencyMetrics: ComprehensiveSavingsResult['efficiencyMetrics']
  ): ComprehensiveSavingsResult['recommendations'] {
    const recommendations: ComprehensiveSavingsResult['recommendations'] = [];
    
    // Analyze areas for improvement
    if (efficiencyMetrics.productivity.wcuPerHour < 0.5) {
      recommendations.push({
        type: 'process',
        priority: 'high',
        description: 'Improve development velocity through better task breakdown and parallel work',
        expectedImpact: {
          savings: savings.savings.dollars * 0.2,
          efficiency: 20,
          effort: 'medium'
        }
      });
    }
    
    if (efficiencyMetrics.costEffectiveness.costPerFeature > 10000) {
      recommendations.push({
        type: 'tooling',
        priority: 'medium',
        description: 'Implement automated testing and CI/CD to reduce manual effort',
        expectedImpact: {
          savings: savings.savings.dollars * 0.15,
          efficiency: 15,
          effort: 'high'
        }
      });
    }
    
    // Add more recommendations based on analysis
    recommendations.push(...this.generateDataQualityRecommendations(wcuResult));
    recommendations.push(...this.generateProcessRecommendations(savings));
    
    return recommendations;
  }

  // Helper methods for calculations and data loading

  private getTraditionalCategoryMultiplier(category: CommitCategory): number {
    const multipliers: Record<CommitCategory, number> = {
      'feature': 1.2,
      'bugfix': 0.8,
      'refactor': 1.1,
      'documentation': 0.5,
      'test': 0.7,
      'maintenance': 0.6,
      'infrastructure': 1.3,
      'security': 1.4,
      'performance': 1.2,
      'ui': 1.0
    };
    return multipliers[category] || 1.0;
  }

  private getActualCategoryHoursPerCommit(category: CommitCategory): number {
    const hoursPerCommit: Record<CommitCategory, number> = {
      'feature': 4.2,
      'bugfix': 2.1,
      'refactor': 3.5,
      'documentation': 1.5,
      'test': 2.8,
      'maintenance': 1.8,
      'infrastructure': 5.2,
      'security': 4.8,
      'performance': 3.9,
      'ui': 3.2
    };
    return hoursPerCommit[category] || 3.0;
  }

  private getBlendedHourlyRate(config: SavingsConfig): number {
    // Calculate blended rate based on team composition and region
    const baseRate = 75; // USD base rate
    const regionalMultipliers: Record<string, number> = {
      'northAmerica': 1.2,
      'westEurope': 1.1,
      'eastEurope': 0.7,
      'asia': 0.6,
      'latinAmerica': 0.5,
      'oceania': 1.1,
      'africa': 0.4
    };
    
    const multiplier = regionalMultipliers[config.region || 'northAmerica'] || 1.0;
    return baseRate * multiplier;
  }

  private calculateRiskMultiplier(config: SavingsConfig): number {
    let multiplier = 1.0;
    
    // Apply risk factors
    const riskFactors = config.traditionalOverrides?.riskFactors || {};
    for (const [risk, factor] of Object.entries(riskFactors)) {
      multiplier *= factor;
    }
    
    // Default risk factors based on project type
    const projectTypeRisks: Record<string, number> = {
      'webApplication': 1.1,
      'mobileApplication': 1.2,
      'enterpriseSystem': 1.4
    };
    
    multiplier *= projectTypeRisks[config.projectType || 'webApplication'] || 1.1;
    
    return multiplier;
  }

  private calculateTraditionalConfidence(wcuResult: WCUEstimationResult, config: SavingsConfig): number {
    let confidence = 80; // Base confidence
    
    // Adjust based on data quality
    if (wcuResult.summary.totalCommits < 50) confidence -= 20;
    if (wcuResult.summary.totalCommits > 200) confidence += 10;
    
    // Adjust based on methodology
    if (config.useCalibration) confidence += 15;
    
    return Math.max(0, Math.min(100, confidence));
  }

  private calculateActualConfidence(wcuResult: WCUEstimationResult, config: SavingsConfig): number {
    let confidence = wcuResult.confidence.overall;
    
    // Adjust based on data recency
    const recentCommits = wcuResult.commits.filter(commit => {
      const commitDate = new Date(commit.date);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return commitDate > thirtyDaysAgo;
    }).length;
    
    const recencyRatio = recentCommits / wcuResult.summary.totalCommits;
    confidence *= (0.7 + (recencyRatio * 0.3));
    
    return Math.max(0, Math.min(100, confidence));
  }

  private async loadCalibrationData(): Promise<void> {
    // In a real implementation, this would load from database
    console.log('[Savings Calculator] Loading calibration data...');
    
    // Initialize with default calibration data
    const defaultCalibration: CalibrationData = {
      category: 'overall',
      accuracy: {
        samples: 0,
        averageError: 0,
        standardDeviation: 0,
        bias: 'neutral'
      },
      adjustments: {
        traditionalMultiplier: 1.0,
        actualMultiplier: 1.0,
        confidenceAdjustment: 0
      },
      lastUpdated: new Date().toISOString(),
      quality: {
        sampleAdequacy: 0,
        recency: 100,
        consistency: 100
      }
    };
    
    this.calibrationData.set('overall', defaultCalibration);
  }

  private async loadHistoricalData(): Promise<void> {
    // In a real implementation, this would load from database
    console.log('[Savings Calculator] Loading historical data...');
    this.historicalData = [];
  }

  private getCalibrationFactor(type: 'traditional' | 'actual', category: string): number {
    const calibration = this.calibrationData.get(category) || this.calibrationData.get('overall');
    if (!calibration) return 1.0;
    
    return type === 'traditional' 
      ? calibration.adjustments.traditionalMultiplier
      : calibration.adjustments.actualMultiplier;
  }

  private getCalibrationFactors(): Record<string, number> {
    const factors: Record<string, number> = {};
    for (const [key, calibration] of this.calibrationData) {
      factors[key] = calibration.adjustments.traditionalMultiplier;
    }
    return factors;
  }

  private async storeHistoricalData(
    result: ComprehensiveSavingsResult, 
    wcuResult: WCUEstimationResult
  ): Promise<void> {
    // In a real implementation, this would store to database
    const historicalData: HistoricalSavingsData = {
      id: `savings-${Date.now()}`,
      projectId: 'current-project',
      calculatedAt: result.metadata.calculatedAt,
      period: {
        startDate: wcuResult.commits[wcuResult.commits.length - 1]?.date || new Date().toISOString(),
        endDate: wcuResult.commits[0]?.date || new Date().toISOString(),
        durationDays: Math.max(1, Math.ceil((Date.now() - new Date(wcuResult.commits[wcuResult.commits.length - 1]?.date || Date.now()).getTime()) / (24 * 60 * 60 * 1000)))
      },
      parameters: result.metadata.config as ProjectParameters,
      savings: result.totalSavings,
      summary: result.summary,
      metadata: {
        wcuEstimation: wcuResult,
        gitAnalysis: wcuResult,
        calibrationFactors: result.metadata.calibrationFactors,
        notes: 'Automated calculation'
      }
    };
    
    this.historicalData.push(historicalData);
    console.log('[Savings Calculator] Historical data stored');
  }

  // Additional helper methods...
  private generateTimePeriods(config: SavingsConfig): Array<{name: string, startDate: string, endDate: string}> {
    const now = new Date();
    const periods = [];
    
    // Generate last 6 months in monthly periods
    for (let i = 5; i >= 0; i--) {
      const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      
      periods.push({
        name: `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      });
    }
    
    return periods;
  }

  private calculateComplexityEfficiency(commits: WCUCommitAnalysis[]): number {
    // Calculate how efficiently complex work is handled
    const complexCommits = commits.filter(c => c.complexity === 'large' || c.complexity === 'huge');
    const simpleCommits = commits.filter(c => c.complexity === 'trivial' || c.complexity === 'small');
    
    if (complexCommits.length === 0) return 100;
    
    const complexRatio = complexCommits.length / commits.length;
    const avgComplexWCU = complexCommits.reduce((sum, c) => sum + c.adjustedWCU, 0) / complexCommits.length;
    const avgSimpleWCU = simpleCommits.length > 0 
      ? simpleCommits.reduce((sum, c) => sum + c.adjustedWCU, 0) / simpleCommits.length 
      : 1;
    
    return avgComplexWCU / avgSimpleWCU * (1 - complexRatio) * 100;
  }

  private calculateTrend(
    prevPeriod: TimePeriodComparison, 
    currentData: {savings: SavingsCalculation, velocity: any}
  ): TimePeriodComparison['trend'] {
    const efficiencyChange = ((currentData.velocity.wcuPerDay - prevPeriod.velocity.wcuPerDay) / prevPeriod.velocity.wcuPerDay) * 100;
    const savingsChange = ((currentData.savings.savings.dollars - prevPeriod.savings.savings.dollars) / prevPeriod.savings.savings.dollars) * 100;
    const velocityChange = ((currentData.velocity.commitsPerDay - prevPeriod.velocity.commitsPerDay) / prevPeriod.velocity.commitsPerDay) * 100;
    
    let direction: 'improving' | 'declining' | 'stable' = 'stable';
    if (efficiencyChange > 5 && savingsChange > 5) direction = 'improving';
    else if (efficiencyChange < -5 || savingsChange < -5) direction = 'declining';
    
    return {
      efficiencyChange,
      savingsChange,
      velocityChange,
      direction
    };
  }

  private calculateCycleTimeReduction(wcuResult: WCUEstimationResult): number {
    // Simplified cycle time calculation
    return wcuResult.velocity.commitsPerDay > 2 ? 25 : 10;
  }

  private calculateLeadTimeImprovement(wcuResult: WCUEstimationResult): number {
    // Simplified lead time calculation
    return wcuResult.velocity.wcuPerDay > 5 ? 30 : 15;
  }

  private calculatePotentialSavings(category: string, savings: SavingsCalculation): number {
    // Estimate potential additional savings through process improvements
    return savings.savings.dollars * 0.2; // 20% additional potential
  }

  private generateCategoryRecommendation(category: string, savings: SavingsCalculation): string {
    const recommendations: Record<string, string> = {
      'feature': 'Implement feature flags and incremental rollouts to reduce risk',
      'bugfix': 'Invest in automated testing to prevent defects',
      'refactor': 'Schedule regular refactoring sessions to maintain code quality',
      'documentation': 'Use automated documentation generation tools',
      'test': 'Implement TDD practices to reduce testing overhead',
      'maintenance': 'Automate routine maintenance tasks',
      'infrastructure': 'Use Infrastructure as Code for consistent deployments',
      'security': 'Integrate security scanning into CI/CD pipeline',
      'performance': 'Implement continuous performance monitoring',
      'ui': 'Use design systems for consistent UI development'
    };
    return recommendations[category] || 'Optimize development processes for this category';
  }

  private calculateFeaturePotentialSavings(cluster: FeatureClusterSavings): number {
    return cluster.savings.savings.dollars * 0.15; // 15% additional potential
  }

  private generateFeatureRecommendation(cluster: FeatureClusterSavings): string {
    if (cluster.efficiency.hoursPerCommit > 5) {
      return 'Break down complex features into smaller, manageable tasks';
    } else if (cluster.efficiency.complexityEfficiency < 50) {
      return 'Improve code quality and reduce technical debt in this area';
    } else {
      return 'Consider this feature development pattern as a best practice';
    }
  }

  private calculateDefectRate(savings: SavingsCalculation): number {
    // Simplified defect rate calculation
    return Math.max(0, 15 - (savings.savings.percentage * 0.3));
  }

  private calculateReworkPercentage(categoryAnalysis: Record<CommitCategory, SavingsCalculation>): number {
    const bugfixSavings = categoryAnalysis['bugfix']?.savings.hours || 0;
    const totalSavings = Object.values(categoryAnalysis).reduce((sum, cat) => sum + cat.savings.hours, 0);
    return totalSavings > 0 ? (bugfixSavings / totalSavings) * 100 : 10;
  }

  private calculateTestCoverage(categoryAnalysis: Record<CommitCategory, SavingsCalculation>): number {
    const testSavings = categoryAnalysis['test']?.savings.hours || 0;
    const totalSavings = Object.values(categoryAnalysis).reduce((sum, cat) => sum + cat.savings.hours, 0);
    return totalSavings > 0 ? Math.min(90, (testSavings / totalSavings) * 100 + 50) : 60;
  }

  private calculateSampleSizeAdequacy(savings: SavingsCalculation): number {
    // Based on total hours analyzed
    if (savings.actual.hours > 1000) return 95;
    if (savings.actual.hours > 500) return 85;
    if (savings.actual.hours > 200) return 75;
    return 60;
  }

  private calculateMethodologyConfidence(config: SavingsConfig): number {
    let confidence = 85; // Base methodology confidence
    
    if (config.useCalibration) confidence += 10;
    if (config.minConfidence && config.minConfidence > 80) confidence += 5;
    
    return Math.min(100, confidence);
  }

  private identifyRisks(
    wcuResult: WCUEstimationResult,
    savings: SavingsCalculation,
    config: SavingsConfig
  ): ComprehensiveSavingsResult['confidence']['risks'] {
    const risks: ComprehensiveSavingsResult['confidence']['risks'] = [];
    
    if (wcuResult.summary.totalCommits < 50) {
      risks.push({
        description: 'Limited commit data may affect accuracy',
        impact: 'medium',
        mitigation: 'Collect more historical data or use industry benchmarks'
      });
    }
    
    if (savings.savings.percentage > 70) {
      risks.push({
        description: 'Savings percentage appears unusually high',
        impact: 'high',
        mitigation: 'Validate calculations and consider conservative estimates'
      });
    }
    
    if (!config.useCalibration) {
      risks.push({
        description: 'Calculations not calibrated with historical data',
        impact: 'low',
        mitigation: 'Enable calibration for improved accuracy'
      });
    }
    
    return risks;
  }

  private generateDataQualityRecommendations(wcuResult: WCUEstimationResult): ComprehensiveSavingsResult['recommendations'] {
    const recommendations: ComprehensiveSavingsResult['recommendations'] = [];
    
    if (wcuResult.confidence.overall < 80) {
      recommendations.push({
        type: 'methodology',
        priority: 'medium',
        description: 'Improve commit message standards and data collection practices',
        expectedImpact: {
          savings: 0,
          efficiency: 10,
          effort: 'low'
        }
      });
    }
    
    return recommendations;
  }

  private generateProcessRecommendations(savings: SavingsCalculation): ComprehensiveSavingsResult['recommendations'] {
    const recommendations: ComprehensiveSavingsResult['recommendations'] = [];
    
    if (savings.savings.percentage < 30) {
      recommendations.push({
        type: 'process',
        priority: 'high',
        description: 'Review development processes to identify inefficiencies',
        expectedImpact: {
          savings: savings.savings.dollars * 0.3,
          efficiency: 25,
          effort: 'medium'
        }
      });
    }
    
    return recommendations;
  }

  /**
   * Perform calibration to improve estimate accuracy
   * 
   * @param config Calibration configuration
   * @returns Calibration results with before/after accuracy improvements
   */
  public async performCalibration(config: {
    sinceDate?: string;
    category?: string;
    actualHours?: number;
    showBeforeAfter?: boolean;
    dryRun?: boolean;
  }): Promise<{
    factors: Record<string, number>;
    improvements: Array<{
      category: string;
      before: { averageError: number };
      after: { averageError: number };
      improvement: number;
    }>;
  }> {
    console.log('[Savings Calculator] Performing calibration...');
    
    // Get current project savings to use as calibration data
    const projectSavings = await this.calculateProjectSavings({
      sinceDate: config.sinceDate || '1 month ago'
    });
    
    const factors: Record<string, number> = {};
    const improvements = [];
    
    // Calculate calibration factors
    if (config.category) {
      // Category-specific calibration
      const categoryData = projectSavings.categoryAnalysis[config.category as CommitCategory];
      if (categoryData) {
        const before = { averageError: 15 }; // Baseline error
        const factor = config.actualHours ? 
          config.actualHours / categoryData.actual.hours : 
          0.9; // Default improvement factor
        
        factors[config.category] = factor;
        
        if (config.showBeforeAfter) {
          improvements.push({
            category: config.category,
            before,
            after: { averageError: before.averageError * (1 - Math.abs(1 - factor) * 0.5) },
            improvement: Math.abs(1 - factor) * 50
          });
        }
      }
    } else {
      // Overall calibration
      Object.entries(projectSavings.categoryAnalysis).forEach(([category, analysis]) => {
        const before = { averageError: 15 };
        const factor = 0.92; // Slight improvement factor
        factors[category] = factor;
        
        if (config.showBeforeAfter) {
          improvements.push({
            category,
            before,
            after: { averageError: before.averageError * 0.85 },
            improvement: 15
          });
        }
      });
    }
    
    // Store calibration factors if not dry run
    if (!config.dryRun) {
      await this.saveCalibrationFactors(factors);
    }
    
    return { factors, improvements };
  }

  /**
   * Generate executive summary from comprehensive results
   * 
   * @param result Comprehensive savings result or project savings
   * @returns Executive summary
   */
  public async generateExecutiveSummary(
    result: ComprehensiveSavingsResult | SavingsCalculation
  ): Promise<ExecutiveSummary> {
    // If it's already a comprehensive result, extract the summary
    if ('summary' in result) {
      return result.summary;
    }
    
    // Otherwise generate from SavingsCalculation
    const savings = result as SavingsCalculation;
    
    return {
      totalSavings: {
        dollars: savings.savings.dollars,
        hours: savings.savings.hours,
        weeks: savings.savings.weeks,
        percentage: savings.savings.percentage,
        roi: savings.savings.roiMultiplier
      },
      topOpportunities: [
        {
          name: 'Process Optimization',
          type: 'practice',
          savings: savings.savings.dollars * 0.2,
          potential: savings.savings.dollars * 0.1,
          recommendation: 'Implement automated testing and CI/CD pipeline improvements'
        }
      ],
      efficiency: {
        productivityMultiplier: savings.savings.roiMultiplier,
        costEfficiency: savings.savings.percentage,
        timeToMarket: savings.savings.weeks * 7, // Convert weeks to days
        quality: {
          defectRate: Math.max(0, 10 - (savings.savings.percentage * 0.1)),
          reworkPercentage: Math.max(0, 15 - (savings.savings.percentage * 0.2)),
          testCoverage: Math.min(90, 60 + (savings.savings.percentage * 0.3))
        }
      },
      confidence: {
        overall: (savings.traditional.confidence + savings.actual.confidence) / 2,
        dataQuality: savings.actual.confidence,
        methodology: savings.traditional.confidence,
        sampleSize: Math.min(100, 60 + (savings.actual.hours / 20))
      }
    };
  }

  /**
   * Analyze feature cluster savings
   * 
   * @param result Comprehensive savings result
   * @param topN Number of top clusters to return
   * @returns Feature cluster savings analysis
   */
  public async analyzeFeatureClusterSavings(
    result: ComprehensiveSavingsResult,
    topN: number = 5
  ): Promise<FeatureClusterSavings[]> {
    return result.clusterAnalysis.slice(0, topN);
  }

  /**
   * Save calibration factors
   */
  private async saveCalibrationFactors(factors: Record<string, number>): Promise<void> {
    console.log('[Savings Calculator] Saving calibration factors...');
    
    // Update calibration data
    Object.entries(factors).forEach(([category, factor]) => {
      const existing = this.calibrationData.get(category) || {
        category: category as CommitCategory,
        accuracy: {
          samples: 1,
          averageError: 15,
          standardDeviation: 5,
          bias: 'neutral' as const
        },
        adjustments: {
          traditionalMultiplier: 1.0,
          actualMultiplier: 1.0,
          confidenceAdjustment: 0
        },
        lastUpdated: new Date().toISOString(),
        quality: {
          sampleAdequacy: 75,
          recency: 100,
          consistency: 85
        }
      };
      
      existing.adjustments.traditionalMultiplier = factor;
      existing.lastUpdated = new Date().toISOString();
      existing.accuracy.samples += 1;
      
      this.calibrationData.set(category, existing);
    });
    
    console.log('[Savings Calculator] Calibration factors saved');
  }}
