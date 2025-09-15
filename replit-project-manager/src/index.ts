/**
 * Replit Project Manager
 * 
 * A comprehensive git-integrated project management tool with cost-benefit analysis
 * for Dart AI and Replit workflows.
 */

// Core services
export { IndustryBenchmarksService } from './estimation/benchmarks.js';
export { WorkContributionEstimator } from './estimation/estimator.js';
export { SavingsCalculator } from './estimation/savingsCalculator.js';
export { GitIntegratedProgressService } from './git/gitIntegration.js';
export { DevProgressService } from './progress/dartProgress.js';
export { AgentMetricsService } from './metrics/agentMetrics.js';
export { DevTaskSyncService, type DevTask } from './tasks/devTaskSync.js';

// Types and interfaces
export type * from './types.js';
export type * from './estimation/benchmarks.js';
export type * from './estimation/estimator.js';
export type * from './estimation/savingsCalculator.js';

// Validation utilities
export { 
  sanitizeGitSinceDate, 
  sanitizeConfidenceThreshold,
  GitAnalysisConfigSchema,
  AnalyzeOptionsSchema,
  ReportOptionsSchema
} from './validation.js';

// Main class for easy initialization
export class ReplitProjectManager {
  private static instance: ReplitProjectManager;
  private gitService: any;
  private progressService: any;
  private savingsCalculator: any;
  private benchmarksService: any;
  private estimator: any;
  private taskSyncService: any;
  
  private constructor() {
    this.gitService = GitIntegratedProgressService.getInstance();
    this.progressService = DevProgressService.getInstance();
    this.savingsCalculator = SavingsCalculator.getInstance();
    this.benchmarksService = IndustryBenchmarksService.getInstance();
    this.estimator = WorkContributionEstimator.getInstance();
    this.taskSyncService = DevTaskSyncService.getInstance();
  }
  
  public static getInstance(): ReplitProjectManager {
    if (!ReplitProjectManager.instance) {
      ReplitProjectManager.instance = new ReplitProjectManager();
    }
    return ReplitProjectManager.instance;
  }
  
  /**
   * Initialize all services
   */
  public async initialize(config?: {
    dartToken?: string;
    workspaceId?: string;
    dartboard?: string;
  }): Promise<void> {
    // Configure services
    if (config) {
      this.progressService.configure(config);
      this.taskSyncService.configure(config);
    }
    
    // Set up git integration
    this.progressService.setGitService(this.gitService);
    
    // Initialize all services
    await Promise.all([
      this.benchmarksService.initialize(),
      this.estimator.initialize(),
      this.savingsCalculator.initialize()
    ]);
    
    console.log('[RPM] Replit Project Manager initialized successfully');
  }
  
  /**
   * Get git analysis service
   */
  public getGitService(): GitIntegratedProgressService {
    return this.gitService;
  }
  
  /**
   * Get progress reporting service
   */
  public getProgressService(): DevProgressService {
    return this.progressService;
  }
  
  /**
   * Get savings calculator
   */
  public getSavingsCalculator(): any {
    return this.savingsCalculator;
  }
  
  /**
   * Get benchmarks service
   */
  public getBenchmarksService(): any {
    return this.benchmarksService;
  }
  
  /**
   * Get estimator service
   */
  public getEstimator(): any {
    return this.estimator;
  }
  
  /**
   * Get development task sync service
   */
  public getTaskSyncService(): any {
    return this.taskSyncService;
  }
  
  /**
   * Quick method to analyze git history with savings
   */
  public async analyzeProject(sinceDate: string = '1 month ago', enableSavings: boolean = true) {
    return this.gitService.analyzeGitHistory(sinceDate, { enableSavings });
  }
  
  /**
   * Quick method to send progress update
   */
  public async sendProgressUpdate(summary: string, details?: {
    added?: string[];
    fixed?: string[];
    improved?: string[];
    nextSteps?: string[];
  }) {
    return this.progressService.sendProgressUpdate({
      summary,
      ...details
    });
  }
  
  /**
   * Test all connections and configurations
   */
  public async test(): Promise<{
    dartConnection: boolean;
    gitRepository: boolean;
    benchmarksLoaded: boolean;
  }> {
    const results = {
      dartConnection: false,
      gitRepository: false,
      benchmarksLoaded: false
    };
    
    try {
      results.dartConnection = await this.progressService.testConnection();
    } catch (error) {
      console.warn('[RPM] Dart connection test failed:', error);
    }
    
    try {
      const status = await this.gitService.getGitStatus();
      results.gitRepository = typeof status === 'string';
    } catch (error) {
      console.warn('[RPM] Git repository test failed:', error);
    }
    
    try {
      const benchmarks = this.benchmarksService.getBenchmarkData();
      results.benchmarksLoaded = !!benchmarks;
    } catch (error) {
      console.warn('[RPM] Benchmarks test failed:', error);
    }
    
    return results;
  }
}

// Default export
export default ReplitProjectManager;