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
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Git commit analysis data structure
 */
export interface CommitAnalysis {
  hash: string;
  author: string;
  date: string;
  message: string;
  filesChanged: number;
  linesAdded: number;
  linesDeleted: number;
  category: CommitCategory;
  complexity: CommitComplexity;
}

/**
 * Commit categories for effort weighting
 */
export type CommitCategory = 'feature' | 'bugfix' | 'refactor' | 'documentation' | 
                     'test' | 'maintenance' | 'infrastructure' | 'security' | 
                     'performance' | 'ui';

/**
 * Commit complexity levels based on size and impact
 */
export type CommitComplexity = 'trivial' | 'small' | 'medium' | 'large' | 'huge';

/**
 * Team member role definitions with standard hourly rates
 */
interface TeamMember {
  role: string;
  hourlyRate: number;
  regionalMultiplier: number;
  experienceLevel: 'junior' | 'mid' | 'senior';
  allocation: number;
}

/**
 * Project estimation parameters
 */
export interface ProjectParameters {
  projectType: 'webApplication' | 'mobileApplication' | 'enterpriseSystem';
  region: 'northAmerica' | 'westEurope' | 'eastEurope' | 'asia' | 'latinAmerica' | 'oceania' | 'africa';
  teamSize: number;
  durationDays: number;
  scaleFactors: {
    precedentedness: 'veryLow' | 'low' | 'nominal' | 'high' | 'veryHigh';
    developmentFlexibility: 'veryLow' | 'low' | 'nominal' | 'high' | 'veryHigh';
    architectureRiskResolution: 'veryLow' | 'low' | 'nominal' | 'high' | 'veryHigh';
    teamCohesion: 'veryLow' | 'low' | 'nominal' | 'high' | 'veryHigh';
    processMaturity: 'veryLow' | 'low' | 'nominal' | 'high' | 'veryHigh';
  };
  riskFactors: string[];
  customRates?: Record<string, number>;
}

/**
 * Work Contribution Unit calculation result
 */
interface WCUResult {
  rawWCU: number;
  adjustedWCU: number;
  estimatedHours: number;
  estimatedCost: number;
  breakdown: {
    commits: number;
    filesChanged: number;
    linesOfCode: number;
    complexity: number;
    category: number;
  };
}

/**
 * Industry Benchmarks Service
 */
export class IndustryBenchmarksService {
  private static instance: IndustryBenchmarksService;
  private industryBenchmarks: any;
  private projectOverrides: any;
  private benchmarksPath: string;
  private projectOverridesPath: string;

  private constructor() {
    // Look for benchmarks in multiple possible locations
    const possiblePaths = [
      path.join(process.cwd(), 'benchmarks', 'industry.json'),
      path.join(__dirname, '../../benchmarks', 'industry.json'),
      path.join(__dirname, '../../../benchmarks', 'industry.json'),
    ];
    
    this.benchmarksPath = possiblePaths[0]; // Default to process.cwd()
    this.projectOverridesPath = path.join(path.dirname(this.benchmarksPath), 'project.json');
    this.industryBenchmarks = null;
    this.projectOverrides = null;
  }

  public static getInstance(): IndustryBenchmarksService {
    if (!IndustryBenchmarksService.instance) {
      IndustryBenchmarksService.instance = new IndustryBenchmarksService();
    }
    return IndustryBenchmarksService.instance;
  }

  /**
   * Initialize the service by loading benchmark data
   */
  public async initialize(): Promise<void> {
    try {
      console.log('[Benchmarks] Loading industry benchmarks...');
      
      // Try to find benchmarks file in multiple locations
      let benchmarksData: string | null = null;
      const possiblePaths = [
        path.join(process.cwd(), 'benchmarks', 'industry.json'),
        path.join(__dirname, '../../benchmarks', 'industry.json'),
        path.join(__dirname, '../../../benchmarks', 'industry.json'),
      ];
      
      for (const benchmarkPath of possiblePaths) {
        try {
          benchmarksData = await fs.readFile(benchmarkPath, 'utf-8');
          this.benchmarksPath = benchmarkPath;
          this.projectOverridesPath = path.join(path.dirname(benchmarkPath), 'project.json');
          break;
        } catch (error) {
          // Continue to next path
        }
      }
      
      if (!benchmarksData) {
        throw new Error('Could not find industry.json benchmarks file');
      }
      
      this.industryBenchmarks = JSON.parse(benchmarksData);
      
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
   */
  public calculateWCU(commits: CommitAnalysis[]): WCUResult {
    if (!this.industryBenchmarks) {
      throw new Error('Benchmarks service not initialized');
    }

    const weights = this.industryBenchmarks.wcuWeights || {
      commits: 1.0,
      filesChanged: 1.5,
      additions: 0.1,
      deletions: 0.05
    };

    const caps = this.industryBenchmarks.estimationCaps || {
      filesChanged: 100,
      additions: 5000,
      deletions: 2000
    };

    let totalRawWCU = 0;
    let totalAdjustedWCU = 0;
    let breakdown = {
      commits: 0,
      filesChanged: 0,
      linesOfCode: 0,
      complexity: 0,
      category: 0
    };

    for (const commit of commits) {
      // Calculate base WCU
      const filesChangedCapped = Math.min(commit.filesChanged, caps.filesChanged);
      const additionsCapped = Math.min(commit.linesAdded, caps.additions);
      const deletionsCapped = Math.min(commit.linesDeleted, caps.deletions);

      const rawWCU = 
        weights.commits * 1 +
        weights.filesChanged * filesChangedCapped +
        weights.additions * additionsCapped +
        weights.deletions * deletionsCapped;

      // Apply category multipliers
      const categoryMultipliers = this.industryBenchmarks.categoryMultipliers || {
        feature: 1.2,
        bugfix: 0.8,
        refactor: 1.0,
        documentation: 0.6,
        test: 0.7,
        maintenance: 0.9,
        infrastructure: 1.1,
        security: 1.4,
        performance: 1.3,
        ui: 0.9
      };

      const categoryMultiplier = categoryMultipliers[commit.category] || 1.0;
      const adjustedWCU = rawWCU * categoryMultiplier;

      totalRawWCU += rawWCU;
      totalAdjustedWCU += adjustedWCU;

      breakdown.commits += weights.commits;
      breakdown.filesChanged += weights.filesChanged * filesChangedCapped;
      breakdown.linesOfCode += weights.additions * additionsCapped + weights.deletions * deletionsCapped;
      breakdown.category += adjustedWCU - rawWCU;
    }

    // Calculate estimated hours and cost
    const hoursPerWCU = this.industryBenchmarks.productivity?.hoursPerWCU || 2.5;
    const blendedHourlyRate = this.industryBenchmarks.baseRates?.blendedRate || 85;

    const estimatedHours = totalAdjustedWCU * hoursPerWCU;
    const estimatedCost = estimatedHours * blendedHourlyRate;

    return {
      rawWCU: totalRawWCU,
      adjustedWCU: totalAdjustedWCU,
      estimatedHours,
      estimatedCost,
      breakdown
    };
  }

  /**
   * Get project parameters with defaults
   */
  public getProjectParameters(overrides: Partial<ProjectParameters> = {}): ProjectParameters {
    const defaults: ProjectParameters = {
      projectType: 'webApplication',
      region: 'northAmerica',
      teamSize: 5,
      durationDays: 90,
      scaleFactors: {
        precedentedness: 'nominal',
        developmentFlexibility: 'nominal',
        architectureRiskResolution: 'nominal',
        teamCohesion: 'nominal',
        processMaturity: 'nominal'
      },
      riskFactors: []
    };

    return { ...defaults, ...overrides };
  }

  /**
   * Calculate risk multipliers based on project parameters
   */
  public calculateRiskMultipliers(params: ProjectParameters): Record<string, number> {
    if (!this.industryBenchmarks) {
      return { overall: 1.0 };
    }

    const riskFactors = this.industryBenchmarks.riskFactors;
    let multiplier = 1.0;

    if (riskFactors) {
      for (const factor of params.riskFactors) {
        const factors = riskFactors[factor];
        if (factors && typeof factors === 'object') {
          multiplier *= (factors as Record<string, number>)[factor] || 1.0;
        }
      }
    }

    return { overall: multiplier };
  }

  /**
   * Get benchmark data (for testing/debugging)
   */
  public getBenchmarkData(): any {
    return this.industryBenchmarks;
  }

  /**
   * Get project override data (for testing/debugging)
   */
  public getProjectOverrides(): any {
    return this.projectOverrides;
  }
}