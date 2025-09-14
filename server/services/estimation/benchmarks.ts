import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Industry Benchmarks Service for Development Cost Estimation
 * 
 * This service provides comprehensive cost estimation capabilities based on:
 * - COCOMO II (COnstructive COst MOdel) for effort estimation
 * - ISBSG (International Software Benchmarking Standards Group) for rates and productivity
 * - DORA (DevOps Research and Assessment) metrics for throughput benchmarking
 * 
 * Features:
 * - Work Contribution Unit (WCU) analysis for git-tracked development
 * - Risk-adjusted cost estimation with regional and project factors
 * - Team composition and capacity planning
 * - Industry-standard productivity benchmarks
 * - Configurable estimation parameters with realistic caps
 * 
 * @author Development Team
 * @version 1.0.0
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Git commit analysis data structure
 */
interface CommitAnalysis {
  /** Unique commit hash */
  hash: string;
  /** Commit author */
  author: string;
  /** Commit date in ISO format */
  date: string;
  /** Commit message */
  message: string;
  /** Number of files changed */
  filesChanged: number;
  /** Lines added in this commit */
  linesAdded: number;
  /** Lines deleted in this commit */
  linesDeleted: number;
  /** Detected commit category (feature, bugfix, etc.) */
  category: CommitCategory;
  /** Calculated complexity level */
  complexity: CommitComplexity;
}

/**
 * Commit categories for effort weighting
 */
type CommitCategory = 'feature' | 'bugfix' | 'refactor' | 'documentation' | 
                     'test' | 'maintenance' | 'infrastructure' | 'security' | 
                     'performance' | 'ui';

/**
 * Commit complexity levels based on size and impact
 */
type CommitComplexity = 'trivial' | 'small' | 'medium' | 'large' | 'huge';

/**
 * Team member role definitions with standard hourly rates
 */
interface TeamMember {
  /** Role identifier */
  role: string;
  /** Hourly rate in USD */
  hourlyRate: number;
  /** Regional adjustment multiplier */
  regionalMultiplier: number;
  /** Experience level (affects productivity) */
  experienceLevel: 'junior' | 'mid' | 'senior';
  /** Allocation percentage for this project */
  allocation: number;
}

/**
 * Project estimation parameters
 */
interface ProjectParameters {
  /** Project type affects team composition and risk factors */
  projectType: 'webApplication' | 'mobileApplication' | 'enterpriseSystem';
  /** Geographic region for cost adjustments */
  region: 'northAmerica' | 'westEurope' | 'eastEurope' | 'asia' | 'latinAmerica' | 'oceania' | 'africa';
  /** Team size (affects coordination overhead) */
  teamSize: number;
  /** Project duration in days */
  durationDays: number;
  /** COCOMO II scale factors */
  scaleFactors: {
    precedentedness: 'veryLow' | 'low' | 'nominal' | 'high' | 'veryHigh';
    developmentFlexibility: 'veryLow' | 'low' | 'nominal' | 'high' | 'veryHigh';
    architectureRiskResolution: 'veryLow' | 'low' | 'nominal' | 'high' | 'veryHigh';
    teamCohesion: 'veryLow' | 'low' | 'nominal' | 'high' | 'veryHigh';
    processMaturity: 'veryLow' | 'low' | 'nominal' | 'high' | 'veryHigh';
  };
  /** Additional risk factors */
  riskFactors: string[];
  /** Custom hourly rate overrides */
  customRates?: Record<string, number>;
}

/**
 * Work Contribution Unit calculation result
 */
interface WCUResult {
  /** Raw WCU score before adjustments */
  rawWCU: number;
  /** Category-adjusted WCU score */
  adjustedWCU: number;
  /** Estimated effort in person-hours */
  estimatedHours: number;
  /** Estimated cost in USD */
  estimatedCost: number;
  /** Breakdown by contribution type */
  breakdown: {
    commits: number;
    filesChanged: number;
    linesOfCode: number;
    complexity: number;
    category: number;
  };
}

/**
 * Comprehensive project estimation result
 */
interface ProjectEstimation {
  /** Total project cost in USD */
  totalCost: number;
  /** Total effort in person-hours */
  totalHours: number;
  /** Total effort in person-months (22 working days) */
  totalPersonMonths: number;
  /** Estimated project duration in calendar days */
  estimatedDuration: number;
  /** Recommended team composition */
  teamComposition: TeamMember[];
  /** Risk-adjusted multipliers applied */
  riskMultipliers: Record<string, number>;
  /** Regional cost adjustments */
  regionalAdjustments: Record<string, number>;
  /** DORA metrics alignment */
  doraAlignment: {
    performanceLevel: 'elite' | 'high' | 'medium' | 'low';
    expectedThroughput: Record<string, number>;
  };
  /** Confidence intervals */
  confidence: {
    low: number;
    high: number;
  };
}

/**
 * Industry Benchmarks Service
 * 
 * Provides comprehensive development cost estimation using industry-standard metrics
 * and git repository analysis for accurate project costing and planning.
 */
export class IndustryBenchmarksService {
  private static instance: IndustryBenchmarksService;
  private industryBenchmarks: any;
  private projectOverrides: any;
  private benchmarksPath: string;
  private projectOverridesPath: string;

  private constructor() {
    this.benchmarksPath = path.join(process.cwd(), 'benchmarks', 'industry.json');
    this.projectOverridesPath = path.join(process.cwd(), 'benchmarks', 'project.json');
    this.industryBenchmarks = null;
    this.projectOverrides = null;
  }

  /**
   * Get singleton instance of the benchmarks service
   */
  public static getInstance(): IndustryBenchmarksService {
    if (!IndustryBenchmarksService.instance) {
      IndustryBenchmarksService.instance = new IndustryBenchmarksService();
    }
    return IndustryBenchmarksService.instance;
  }

  /**
   * Initialize the service by loading benchmark data
   * 
   * @throws Error if benchmark files cannot be loaded
   */
  public async initialize(): Promise<void> {
    try {
      console.log('[Benchmarks] Loading industry benchmarks...');
      
      // Load industry benchmarks
      const industryData = await fs.readFile(this.benchmarksPath, 'utf-8');
      this.industryBenchmarks = JSON.parse(industryData);
      
      // Load project overrides if they exist
      try {
        const projectData = await fs.readFile(this.projectOverridesPath, 'utf-8');
        this.projectOverrides = JSON.parse(projectData);
        console.log('[Benchmarks] Project overrides loaded successfully');
      } catch (error) {
        console.log('[Benchmarks] No project overrides found, using industry defaults');
        this.projectOverrides = {};
      }
      
      console.log('[Benchmarks] Industry benchmarks service initialized successfully');
    } catch (error) {
      console.error('[Benchmarks] Failed to initialize:', error);
      throw new Error('Failed to load industry benchmarks');
    }
  }

  /**
   * Calculate Work Contribution Units (WCU) for a set of commits
   * 
   * WCU provides a standardized measure of development effort based on:
   * - Number of commits (base unit)
   * - Files changed (weighted by operation type)
   * - Lines of code changed (added/deleted with different weights)
   * - Commit complexity (based on size and impact)
   * - Category multipliers (feature vs. bugfix vs. maintenance)
   * 
   * @param commits Array of commit analysis data
   * @param parameters Project-specific parameters for adjustment
   * @returns Detailed WCU calculation result
   */
  public calculateWCU(commits: CommitAnalysis[], parameters?: Partial<ProjectParameters>): WCUResult {
    if (!this.industryBenchmarks) {
      throw new Error('Benchmarks service not initialized');
    }

    const weights = this.getBenchmarkValue('workContributionUnits.weights');
    const categoryMultipliers = this.getBenchmarkValue('workContributionUnits.categoryMultipliers');
    
    let totalWCU = 0;
    const breakdown = {
      commits: 0,
      filesChanged: 0,
      linesOfCode: 0,
      complexity: 0,
      category: 0
    };

    for (const commit of commits) {
      // Base commit weight
      const baseCommitWeight = weights.commits.base;
      breakdown.commits += baseCommitWeight;

      // Files changed weight (assuming modified for simplicity)
      const filesWeight = commit.filesChanged * weights.filesChanged.modified;
      breakdown.filesChanged += filesWeight;

      // Lines of code weight
      const linesWeight = 
        (commit.linesAdded * weights.linesOfCode.added) +
        (commit.linesDeleted * weights.linesOfCode.deleted);
      breakdown.linesOfCode += linesWeight;

      // Complexity multiplier
      const complexityMultiplier = weights.commitComplexity[commit.complexity] || 1.0;
      breakdown.complexity += complexityMultiplier;

      // Category multiplier
      const categoryMultiplier = categoryMultipliers[commit.category] || 1.0;
      breakdown.category += categoryMultiplier;

      // Calculate total WCU for this commit
      const commitWCU = (baseCommitWeight + filesWeight + linesWeight) * 
                       complexityMultiplier * categoryMultiplier;
      totalWCU += commitWCU;
    }

    // Apply regional and project-specific adjustments
    const adjustmentFactor = this.calculateAdjustmentFactor(parameters);
    const adjustedWCU = totalWCU * adjustmentFactor;

    // Convert WCU to hours and cost
    const baseHoursPerWCU = 3.2; // Empirically derived baseline
    const estimatedHours = adjustedWCU * baseHoursPerWCU;
    
    // Calculate cost using blended team rates
    const blendedRate = this.calculateBlendedRate(parameters);
    const estimatedCost = estimatedHours * blendedRate;

    // Apply estimation caps for realism
    const cappedResults = this.applyEstimationCaps({
      rawWCU: totalWCU,
      adjustedWCU,
      estimatedHours,
      estimatedCost,
      breakdown
    });

    return cappedResults;
  }

  /**
   * Analyze git commits to extract development metrics
   * 
   * @param gitLogData Raw git log output
   * @returns Array of analyzed commits with categorization and complexity
   */
  public analyzeCommits(gitLogData: string): CommitAnalysis[] {
    const commitLines = gitLogData.split('\n').filter(line => line.trim());
    const commits: CommitAnalysis[] = [];

    for (const line of commitLines) {
      try {
        // Assuming format: "hash|author|date|message|files|additions|deletions"
        const [hash, author, date, message, files, additions, deletions] = line.split('|');
        
        const commit: CommitAnalysis = {
          hash,
          author,
          date,
          message,
          filesChanged: parseInt(files) || 0,
          linesAdded: parseInt(additions) || 0,
          linesDeleted: parseInt(deletions) || 0,
          category: this.categorizeCommit(message),
          complexity: this.assessComplexity(
            parseInt(files) || 0,
            parseInt(additions) || 0,
            parseInt(deletions) || 0
          )
        };

        commits.push(commit);
      } catch (error) {
        console.warn('[Benchmarks] Failed to parse commit line:', line);
      }
    }

    return commits;
  }

  /**
   * Generate comprehensive project estimation
   * 
   * @param commits Historical commit data for analysis
   * @param parameters Project-specific parameters
   * @returns Complete project estimation with costs, timeline, and team recommendations
   */
  public estimateProject(commits: CommitAnalysis[], parameters: ProjectParameters): ProjectEstimation {
    if (!this.industryBenchmarks) {
      throw new Error('Benchmarks service not initialized');
    }

    // Calculate base WCU
    const wcuResult = this.calculateWCU(commits, parameters);

    // Get team composition
    const teamComposition = this.getTeamComposition(parameters);

    // Calculate risk multipliers
    const riskMultipliers = this.calculateRiskMultipliers(parameters);

    // Apply COCOMO II scale factors
    const scaleFactorMultiplier = this.calculateScaleFactorMultiplier(parameters.scaleFactors);

    // Regional adjustments
    const regionalMultiplier = this.getBenchmarkValue(`baseRates.regionalMultipliers.${parameters.region}`) || 1.0;

    // Calculate totals with all adjustments
    const baseEffort = wcuResult.estimatedHours;
    const riskAdjustedEffort = baseEffort * Object.values(riskMultipliers).reduce((a, b) => a * b, 1);
    const scaleAdjustedEffort = riskAdjustedEffort * scaleFactorMultiplier;
    const finalEffort = scaleAdjustedEffort;

    const totalHours = finalEffort;
    const totalCost = finalEffort * this.calculateBlendedRate(parameters) * regionalMultiplier;
    const totalPersonMonths = totalHours / (22 * 8); // 22 working days, 8 hours per day

    // Estimate duration considering team size and coordination overhead
    const coordinationOverhead = this.calculateCoordinationOverhead(parameters.teamSize);
    const estimatedDuration = (totalPersonMonths / parameters.teamSize) * 30 * coordinationOverhead;

    // DORA alignment assessment
    const doraAlignment = this.assessDoraAlignment(commits, parameters);

    // Confidence intervals (based on historical variance)
    const confidence = {
      low: totalCost * 0.7,
      high: totalCost * 1.4
    };

    return {
      totalCost: Math.round(totalCost),
      totalHours: Math.round(totalHours),
      totalPersonMonths: Math.round(totalPersonMonths * 10) / 10,
      estimatedDuration: Math.round(estimatedDuration),
      teamComposition,
      riskMultipliers,
      regionalAdjustments: { [parameters.region]: regionalMultiplier },
      doraAlignment,
      confidence
    };
  }

  /**
   * Get benchmark value with project override support
   * 
   * @param path Dot-notation path to benchmark value
   * @returns Benchmark value with project overrides applied
   */
  private getBenchmarkValue(path: string): any {
    const pathParts = path.split('.');
    
    // Check project overrides first
    if (this.projectOverrides) {
      let overrideValue = this.projectOverrides;
      for (const part of pathParts) {
        if (overrideValue && typeof overrideValue === 'object' && part in overrideValue) {
          overrideValue = overrideValue[part];
        } else {
          overrideValue = null;
          break;
        }
      }
      if (overrideValue !== null) {
        return overrideValue;
      }
    }

    // Fall back to industry benchmarks
    let value = this.industryBenchmarks;
    for (const part of pathParts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return null;
      }
    }
    return value;
  }

  /**
   * Categorize commit based on message keywords
   * 
   * @param message Commit message
   * @returns Detected category
   */
  private categorizeCommit(message: string): CommitCategory {
    const msg = message.toLowerCase();
    
    if (msg.includes('fix') || msg.includes('bug') || msg.includes('patch')) {
      return 'bugfix';
    }
    if (msg.includes('test') || msg.includes('spec')) {
      return 'test';
    }
    if (msg.includes('doc') || msg.includes('readme') || msg.includes('comment')) {
      return 'documentation';
    }
    if (msg.includes('refactor') || msg.includes('cleanup') || msg.includes('simplify')) {
      return 'refactor';
    }
    if (msg.includes('performance') || msg.includes('optimize') || msg.includes('speed')) {
      return 'performance';
    }
    if (msg.includes('security') || msg.includes('auth') || msg.includes('vulnerability')) {
      return 'security';
    }
    if (msg.includes('infrastructure') || msg.includes('deploy') || msg.includes('ci/cd')) {
      return 'infrastructure';
    }
    if (msg.includes('ui') || msg.includes('style') || msg.includes('css') || msg.includes('design')) {
      return 'ui';
    }
    if (msg.includes('maintain') || msg.includes('update') || msg.includes('dependency')) {
      return 'maintenance';
    }
    
    return 'feature'; // Default category
  }

  /**
   * Assess commit complexity based on size metrics
   * 
   * @param filesChanged Number of files changed
   * @param linesAdded Lines added
   * @param linesDeleted Lines deleted
   * @returns Complexity level
   */
  private assessComplexity(filesChanged: number, linesAdded: number, linesDeleted: number): CommitComplexity {
    const totalLines = linesAdded + linesDeleted;
    
    if (filesChanged <= 1 && totalLines <= 10) {
      return 'trivial';
    }
    if (filesChanged <= 3 && totalLines <= 50) {
      return 'small';
    }
    if (filesChanged <= 10 && totalLines <= 200) {
      return 'medium';
    }
    if (filesChanged <= 25 && totalLines <= 1000) {
      return 'large';
    }
    
    return 'huge';
  }

  /**
   * Calculate adjustment factor based on project parameters
   * 
   * @param parameters Project parameters
   * @returns Combined adjustment multiplier
   */
  private calculateAdjustmentFactor(parameters?: Partial<ProjectParameters>): number {
    if (!parameters) {
      return 1.0;
    }

    let factor = 1.0;

    // Team size adjustment (Brooks' Law consideration)
    if (parameters.teamSize) {
      if (parameters.teamSize > 10) {
        factor *= 1.2; // Coordination overhead
      } else if (parameters.teamSize < 3) {
        factor *= 1.1; // Limited specialization
      }
    }

    return factor;
  }

  /**
   * Calculate blended hourly rate for the team
   * 
   * @param parameters Project parameters
   * @returns Blended hourly rate in USD
   */
  private calculateBlendedRate(parameters?: Partial<ProjectParameters>): number {
    const baseRates = this.getBenchmarkValue('baseRates.globalAverages');
    
    if (parameters?.customRates) {
      // Use custom rates if provided
      const rates = Object.values(parameters.customRates);
      return rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
    }

    // Calculate weighted average based on typical team composition
    const roles = ['seniorDeveloper', 'midLevelDeveloper', 'qaEngineer'];
    const weights = [0.4, 0.4, 0.2];
    
    let weightedSum = 0;
    for (let i = 0; i < roles.length; i++) {
      weightedSum += (baseRates[roles[i]] || 75) * weights[i];
    }

    return weightedSum;
  }

  /**
   * Apply estimation caps to prevent unrealistic values
   * 
   * @param result Raw estimation result
   * @returns Capped estimation result
   */
  private applyEstimationCaps(result: WCUResult): WCUResult {
    const caps = this.getBenchmarkValue('estimationCaps');
    
    // Apply caps
    const cappedHours = Math.min(
      Math.max(result.estimatedHours, caps.minHoursPerCommit),
      caps.maxHoursPerCommit * result.breakdown.commits
    );
    
    const cappedCost = Math.min(
      Math.max(result.estimatedCost, caps.minCostPerCommit),
      caps.maxCostPerCommit * result.breakdown.commits
    );

    return {
      ...result,
      estimatedHours: cappedHours,
      estimatedCost: cappedCost
    };
  }

  /**
   * Get recommended team composition based on project type
   * 
   * @param parameters Project parameters
   * @returns Array of team members with roles and rates
   */
  private getTeamComposition(parameters: ProjectParameters): TeamMember[] {
    const composition = this.getBenchmarkValue(`teamComposition.${parameters.projectType}`);
    const baseRates = this.getBenchmarkValue('baseRates.globalAverages');
    const regionalMultiplier = this.getBenchmarkValue(`baseRates.regionalMultipliers.${parameters.region}`) || 1.0;

    const team: TeamMember[] = [];
    
    for (const [role, allocation] of Object.entries(composition)) {
      const baseRole = role.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
      const hourlyRate = (baseRates[role] || 75) * regionalMultiplier;
      
      team.push({
        role: baseRole,
        hourlyRate: Math.round(hourlyRate),
        regionalMultiplier,
        experienceLevel: 'mid', // Default assumption
        allocation: allocation as number
      });
    }

    return team;
  }

  /**
   * Calculate risk multipliers based on project factors
   * 
   * @param parameters Project parameters
   * @returns Risk multiplier values
   */
  private calculateRiskMultipliers(parameters: ProjectParameters): Record<string, number> {
    const riskFactors = this.getBenchmarkValue('riskFactors');
    const multipliers: Record<string, number> = {};

    // Early return if riskFactors is null or not an object
    if (!riskFactors || typeof riskFactors !== 'object') {
      console.warn('[Benchmarks] Risk factors not found in benchmark data');
      return multipliers;
    }

    for (const factor of parameters.riskFactors) {
      // Check all risk categories
      for (const [category, factors] of Object.entries(riskFactors)) {
        if (factors && typeof factors === 'object' && factors !== null && factor in factors) {
          const factorValue = (factors as Record<string, number>)[factor];
          if (typeof factorValue === 'number') {
            multipliers[factor] = factorValue;
            break;
          }
        }
      }
    }

    return multipliers;
  }

  /**
   * Calculate COCOMO II scale factor multiplier
   * 
   * @param scaleFactors Scale factor ratings
   * @returns Combined scale factor multiplier
   */
  private calculateScaleFactorMultiplier(scaleFactors: ProjectParameters['scaleFactors']): number {
    const factors = this.getBenchmarkValue('developmentProductivity.projectScaleFactors');
    
    let totalScaleFactor = 0;
    for (const [factor, rating] of Object.entries(scaleFactors)) {
      if (factors[factor] && factors[factor][rating]) {
        totalScaleFactor += factors[factor][rating];
      }
    }

    // COCOMO II formula: Effort = A * Size^E where E = 0.91 + 0.01 * Σ(SF)
    const exponent = 0.91 + (0.01 * totalScaleFactor);
    return Math.pow(1.2, exponent - 1); // Normalized multiplier
  }

  /**
   * Calculate coordination overhead based on team size
   * 
   * @param teamSize Number of team members
   * @returns Coordination overhead multiplier
   */
  private calculateCoordinationOverhead(teamSize: number): number {
    // Based on Brooks' Law and empirical studies
    if (teamSize <= 2) return 1.0;
    if (teamSize <= 5) return 1.1;
    if (teamSize <= 10) return 1.25;
    if (teamSize <= 20) return 1.5;
    return 1.8; // Large teams have significant coordination overhead
  }

  /**
   * Assess project alignment with DORA metrics
   * 
   * @param commits Historical commit data
   * @param parameters Project parameters
   * @returns DORA performance assessment
   */
  private assessDoraAlignment(commits: CommitAnalysis[], parameters: ProjectParameters): ProjectEstimation['doraAlignment'] {
    const doraMetrics = this.getBenchmarkValue('doraMetrics');
    
    // Calculate commits per day
    if (commits.length === 0) {
      return {
        performanceLevel: 'low',
        expectedThroughput: doraMetrics.throughputBenchmarks.low
      };
    }

    const dateRange = this.getDateRange(commits);
    const commitsPerDay = commits.length / dateRange;

    // Determine performance level based on throughput
    let performanceLevel: 'elite' | 'high' | 'medium' | 'low' = 'low';
    
    if (commitsPerDay >= doraMetrics.throughputBenchmarks.elite.commitsPerDay) {
      performanceLevel = 'elite';
    } else if (commitsPerDay >= doraMetrics.throughputBenchmarks.high.commitsPerDay) {
      performanceLevel = 'high';
    } else if (commitsPerDay >= doraMetrics.throughputBenchmarks.medium.commitsPerDay) {
      performanceLevel = 'medium';
    }

    return {
      performanceLevel,
      expectedThroughput: doraMetrics.throughputBenchmarks[performanceLevel]
    };
  }

  /**
   * Calculate date range in days from commit history
   * 
   * @param commits Array of commits
   * @returns Number of days in the range
   */
  private getDateRange(commits: CommitAnalysis[]): number {
    if (commits.length === 0) return 1;

    const dates = commits.map(c => new Date(c.date)).sort((a, b) => a.getTime() - b.getTime());
    const earliest = dates[0];
    const latest = dates[dates.length - 1];
    
    const diffTime = latest.getTime() - earliest.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(diffDays, 1);
  }

  /**
   * Export estimation data for external analysis
   * 
   * @param estimation Project estimation result
   * @returns JSON string with formatted estimation data
   */
  public exportEstimation(estimation: ProjectEstimation): string {
    const exportData = {
      timestamp: new Date().toISOString(),
      estimation,
      benchmarkVersion: this.industryBenchmarks?.metadata?.version || 'unknown',
      generatedBy: 'IndustryBenchmarksService'
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Validate project parameters for estimation
   * 
   * @param parameters Project parameters to validate
   * @returns Array of validation errors (empty if valid)
   */
  public validateParameters(parameters: ProjectParameters): string[] {
    const errors: string[] = [];

    if (!parameters.projectType) {
      errors.push('Project type is required');
    }

    if (!parameters.region) {
      errors.push('Region is required');
    }

    if (parameters.teamSize < 1 || parameters.teamSize > 100) {
      errors.push('Team size must be between 1 and 100');
    }

    if (parameters.durationDays < 1 || parameters.durationDays > 1095) {
      errors.push('Duration must be between 1 and 1095 days (3 years)');
    }

    return errors;
  }
}

// Export singleton instance
export const industryBenchmarksService = IndustryBenchmarksService.getInstance();