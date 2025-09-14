import simpleGit, { SimpleGit, LogResult } from 'simple-git';
import { DevProgressService } from './devProgress.js';
import { SavingsCalculator, SavingsCalculation, ExecutiveSummary, FeatureClusterSavings } from './estimation/savingsCalculator.js';
import { ProjectParameters } from './estimation/benchmarks.js';
import { GitAnalysisConfigSchema, sanitizeGitSinceDate } from '../../shared/gitValidation.js';
import fs from 'fs/promises';
import path from 'path';


interface GitCommit {
  hash: string;
  author: string;
  date: string;
  message: string;
}

interface CommitCategory {
  name: string;
  commits: GitCommit[];
  keywords: string[];
}

interface GitAnalysisResult {
  totalCommits: number;
  dateRange: string;
  categories: CommitCategory[];
  topContributors: { author: string; commits: number }[];
  fileStats: { additions: number; deletions: number; filesChanged: number };
  /** Savings analysis data (optional, may be null if disabled or failed) */
  savings?: {
    /** Overall savings calculation */
    calculation: SavingsCalculation;
    /** Executive summary with key metrics */
    summary: ExecutiveSummary;
    /** Top feature clusters by savings */
    topFeatures: FeatureClusterSavings[];
    /** Confidence in savings calculation (0-100) */
    confidence: number;
    /** Whether savings calculation succeeded */
    calculationSucceeded: boolean;
    /** Error message if calculation failed */
    errorMessage?: string;
  };
}

/** Configuration options for git analysis and savings calculation */
interface GitAnalysisConfig {
  /** Date to start analysis from */
  sinceDate?: string;
  /** Enable savings calculation */
  enableSavings?: boolean;
  /** Minimum confidence threshold for savings reporting */
  confidenceThreshold?: number;
  /** Project parameters for savings calculation */
  projectParameters?: Partial<ProjectParameters>;
  /** Send report to Dart AI */
  sendToDart?: boolean;
}

export class GitIntegratedProgressService {
  private static instance: GitIntegratedProgressService;
  private devProgressService: DevProgressService;
  private savingsCalculator: SavingsCalculator;
  private savingsInitialized: boolean = false;
  private git: SimpleGit;

  private constructor() {
    this.devProgressService = DevProgressService.getInstance();
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
   * Initialize savings calculator service
   */
  private async initializeSavings(): Promise<void> {
    if (this.savingsInitialized) return;
    
    try {
      await this.savingsCalculator.initialize();
      this.savingsInitialized = true;
      console.log('[GitProgress] Savings calculator initialized successfully');
    } catch (error) {
      console.warn('[GitProgress] Failed to initialize savings calculator:', error);
      this.savingsInitialized = false;
    }
  }

  /**
   * Analyze git history and categorize commits by functionality with optional savings analysis
   */
  public async analyzeGitHistory(configOrSinceDate?: string | GitAnalysisConfig): Promise<GitAnalysisResult> {
    // Handle legacy string parameter for backward compatibility
    const rawConfig: GitAnalysisConfig = typeof configOrSinceDate === 'string' 
      ? { sinceDate: configOrSinceDate, enableSavings: true }
      : configOrSinceDate || { enableSavings: true };
    
    // Validate configuration using Zod schema
    const config = GitAnalysisConfigSchema.parse(rawConfig);
    const sinceDate = config.sinceDate || '1 month ago';
    
    // Sanitize and validate the since date to prevent injection
    const safeSinceDate = sanitizeGitSinceDate(sinceDate);
    
    try {
      console.log('[GitProgress] Analyzing git history...');
      
      // Get commit history using secure simple-git API
      // Using the --since parameter correctly for simple-git
      const logResult: LogResult = await this.git.log({
        format: {
          hash: '%h',
          author_name: '%an',
          date: '%ad',
          message: '%s'
        },
        '--since': safeSinceDate,
        '--date': 'short'
      });
      
      // Parse commits from simple-git result
      const commits: GitCommit[] = logResult.all.map(commit => ({
        hash: commit.hash,
        author: commit.author_name,
        date: commit.date,
        message: commit.message
      }));

      // Get file statistics
      const fileStats = await this.getFileStatistics(sinceDate);

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

      const result: GitAnalysisResult = {
        totalCommits: commits.length,
        dateRange,
        categories,
        topContributors,
        fileStats
      };

      // Add savings analysis if enabled
      if (config.enableSavings !== false) {
        result.savings = await this.calculateSavings(sinceDate, config);
      }

      return result;

    } catch (error) {
      console.error('[GitProgress] Error analyzing git history:', error);
      throw error;
    }
  }

  /**
   * Calculate savings analysis for the given time period
   */
  private async calculateSavings(sinceDate: string, config: GitAnalysisConfig): Promise<GitAnalysisResult['savings']> {
    try {
      // Initialize savings calculator if needed
      await this.initializeSavings();
      
      if (!this.savingsInitialized) {
        return {
          calculation: {} as SavingsCalculation,
          summary: {} as ExecutiveSummary,
          topFeatures: [],
          confidence: 0,
          calculationSucceeded: false,
          errorMessage: 'Savings calculator not initialized'
        };
      }

      console.log('[GitProgress] Calculating project savings...');
      
      // Prepare savings configuration
      const savingsConfig = {
        sinceDate,
        enableHistoricalTracking: true,
        enableFeatureClustering: true,
        enableExecutiveSummary: true,
        includeConfidenceMetrics: true,
        confidenceThreshold: config.confidenceThreshold || 70,
        ...config.projectParameters
      };

      // Calculate comprehensive project savings
      const projectSavings = await this.savingsCalculator.calculateProjectSavings(savingsConfig);
      
      // Get executive summary
      const executiveSummary = await this.savingsCalculator.generateExecutiveSummary(projectSavings);
      
      // Get top feature clusters by savings
      const featureClusters = await this.savingsCalculator.analyzeFeatureClusterSavings(projectSavings, 5);
      
      // Calculate overall confidence
      const confidence = Math.min(
        projectSavings.confidence.overall,
        executiveSummary.confidence.overall
      );

      return {
        calculation: projectSavings,
        summary: executiveSummary,
        topFeatures: featureClusters,
        confidence,
        calculationSucceeded: true
      };

    } catch (error) {
      console.warn('[GitProgress] Savings calculation failed:', error);
      return {
        calculation: {} as SavingsCalculation,
        summary: {} as ExecutiveSummary,
        topFeatures: [],
        confidence: 0,
        calculationSucceeded: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get file change statistics from git using secure simple-git API
   */
  private async getFileStatistics(sinceDate: string): Promise<{ additions: number; deletions: number; filesChanged: number }> {
    try {
      // Sanitize the since date to prevent injection
      const safeSinceDate = sanitizeGitSinceDate(sinceDate);
      
      // Get log with numstat to calculate file changes
      const logResult = await this.git.log({
        '--since': safeSinceDate,
        '--numstat': null,
        maxCount: 1000
      });
      
      let totalAdditions = 0;
      let totalDeletions = 0;
      const changedFiles = new Set<string>();
      
      // Parse numstat data from log results
      logResult.all.forEach(commit => {
        if (commit.diff?.files) {
          commit.diff.files.forEach(file => {
            changedFiles.add(file.file);
            totalAdditions += file.insertions || 0;
            totalDeletions += file.deletions || 0;
          });
        }
      });
      
      return {
        filesChanged: changedFiles.size,
        additions: totalAdditions,
        deletions: totalDeletions
      };
    } catch (error) {
      console.warn('[GitProgress] Could not get file statistics:', error);
      // Fallback: Try to get basic stats from current working directory
      try {
        const status = await this.git.status();
        return {
          filesChanged: status.files.length,
          additions: 0,
          deletions: 0
        };
      } catch (fallbackError) {
        return { additions: 0, deletions: 0, filesChanged: 0 };
      }
    }
  }

  /**
   * Categorize commits by functionality based on commit messages
   */
  private async categorizeCommits(commits: GitCommit[]): Promise<CommitCategory[]> {
    const categories: CommitCategory[] = [
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
   * Generate and send cumulative progress report with optional savings analysis
   */
  public async generateCumulativeReport(
    configOrSinceDate?: string | GitAnalysisConfig, 
    legacySendToDart?: boolean
  ): Promise<void> {
    // Handle legacy parameters for backward compatibility
    const config: GitAnalysisConfig = typeof configOrSinceDate === 'string' 
      ? { 
          sinceDate: configOrSinceDate, 
          sendToDart: legacySendToDart !== undefined ? legacySendToDart : true,
          enableSavings: true 
        }
      : configOrSinceDate || { enableSavings: true, sendToDart: true };
    
    const sinceDate = config.sinceDate || '1 month ago';
    const sendToDart = config.sendToDart !== false;
    try {
      console.log('[GitProgress] Generating cumulative progress report...');
      
      const analysis = await this.analyzeGitHistory(config);
      
      // Generate natural language summary
      const summary = this.generateProgressSummary(analysis);
      
      // Generate detailed breakdown
      const { added, fixed, improved } = this.categorizeChanges(analysis);
      
      // Save comprehensive report
      await this.saveComprehensiveReport(analysis, summary);
      
      // Send to Dart AI if requested
      if (sendToDart) {
        await this.devProgressService.sendProgressUpdate({
          summary,
          added,
          fixed,
          improved
        });
        
        console.log('[GitProgress] Cumulative report sent to Dart AI successfully');
      }
      
      // Display report to console
      this.displayReport(analysis, summary);
      
    } catch (error) {
      console.error('[GitProgress] Error generating cumulative report:', error);
      throw error;
    }
  }

  /**
   * Generate natural language progress summary with compelling savings headlines
   */
  private generateProgressSummary(analysis: GitAnalysisResult): string {
    const { totalCommits, categories, topContributors, fileStats, savings } = analysis;
    
    const majorFeatures = categories
      .filter(cat => cat.commits.length >= 3)
      .map(cat => cat.name)
      .slice(0, 3);
    
    let summary = `Comprehensive development progress spanning ${analysis.dateRange} with ${totalCommits} commits. `;
    
    // Add compelling savings headlines if available
    if (savings?.calculationSucceeded && savings.confidence >= 70) {
      const { calculation, summary: execSummary } = savings;
      
      if (calculation?.savings?.dollars && calculation.savings.dollars > 1000) {
        summary += `💰 SIGNIFICANT SAVINGS ACHIEVED: $${Math.round(calculation.savings.dollars).toLocaleString()} saved (${calculation.savings.percentage || 0}% cost reduction) `;
      }
      
      if (calculation?.savings?.weeks && calculation.savings.weeks > 1) {
        summary += `⚡ ${Math.round(calculation.savings.weeks)} weeks ahead of traditional timeline `;
      }
      
      if (execSummary?.efficiency?.productivityMultiplier && execSummary.efficiency.productivityMultiplier > 1.5) {
        summary += `🚀 ${execSummary.efficiency.productivityMultiplier}x productivity multiplier vs industry standards `;
      }
      
      if (execSummary?.totalSavings?.roi && execSummary.totalSavings.roi > 2) {
        summary += `📈 ${execSummary.totalSavings.roi}x ROI on development investment `;
      }
    }
    
    if (majorFeatures.length > 0) {
      summary += `Major development areas include: ${majorFeatures.join(', ')}. `;
    }
    
    if (fileStats.filesChanged > 0) {
      summary += `Code changes: ${fileStats.filesChanged} files modified, ${fileStats.additions} additions, ${fileStats.deletions} deletions. `;
    }
    
    if (topContributors.length > 0) {
      summary += `Primary contributor: ${topContributors[0].author} (${topContributors[0].commits} commits).`;
    }
    
    // Add savings context if available but with lower confidence
    if (savings?.calculationSucceeded && savings.confidence >= 50 && savings.confidence < 70) {
      const savingsAmount = savings.calculation?.savings?.dollars;
      if (savingsAmount !== undefined) {
        summary += ` Estimated cost savings: $${Math.round(savingsAmount).toLocaleString()} (${savings.confidence}% confidence).`;
      }
    }
    
    return summary;
  }

  /**
   * Categorize changes for progress reporting with savings context
   */
  private categorizeChanges(analysis: GitAnalysisResult): { added: string[], fixed: string[], improved: string[] } {
    const added: string[] = [];
    const fixed: string[] = [];
    const improved: string[] = [];
    
    // Create mapping of category names to savings data for efficiency lookup
    const categorySavingsMap = new Map<string, { savings: number; efficiency: number }>();
    if (analysis.savings?.calculationSucceeded && analysis.savings.topFeatures) {
      analysis.savings.topFeatures.forEach(feature => {
        const categoryName = feature.cluster?.name;
        if (categoryName && feature.savings?.savings?.dollars !== undefined && feature.efficiency?.velocityScore !== undefined) {
          categorySavingsMap.set(categoryName, {
            savings: feature.savings.savings.dollars,
            efficiency: feature.efficiency.velocityScore
          });
        }
      });
    }
    
    analysis.categories.forEach(category => {
      const commitCount = category.commits.length;
      const categoryName = category.name;
      
      // Get savings data for this category if available
      const categorySavings = categorySavingsMap.get(categoryName);
      const savingsContext = categorySavings && categorySavings.savings > 100 
        ? ` - $${Math.round(categorySavings.savings).toLocaleString()} saved` 
        : '';
      const efficiencyContext = categorySavings && categorySavings.efficiency > 0.8 
        ? ` 🚀` 
        : '';
      
      // Determine if this represents new features, fixes, or improvements
      const hasNewKeywords = category.commits.some(c => 
        c.message.toLowerCase().includes('add') || 
        c.message.toLowerCase().includes('implement') ||
        c.message.toLowerCase().includes('create')
      );
      
      const hasFixKeywords = category.commits.some(c => 
        c.message.toLowerCase().includes('fix') || 
        c.message.toLowerCase().includes('resolve') ||
        c.message.toLowerCase().includes('address')
      );
      
      const hasImproveKeywords = category.commits.some(c => 
        c.message.toLowerCase().includes('improve') || 
        c.message.toLowerCase().includes('enhance') ||
        c.message.toLowerCase().includes('update')
      );
      
      const categoryDescription = `${categoryName} (${commitCount} commits)${savingsContext}${efficiencyContext}`;
      
      if (hasNewKeywords) {
        added.push(categoryDescription);
      } else if (hasFixKeywords) {
        fixed.push(categoryDescription);
      } else if (hasImproveKeywords) {
        improved.push(categoryDescription);
      } else {
        improved.push(categoryDescription);
      }
    });
    
    return { added, fixed, improved };
  }

  /**
   * Save comprehensive report with savings data to file
   */
  private async saveComprehensiveReport(analysis: GitAnalysisResult, summary: string): Promise<void> {
    const reportsDir = '.dart-reports';
    await fs.mkdir(reportsDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(reportsDir, `git-analysis-${timestamp}.json`);
    
    const report = {
      timestamp: new Date().toISOString(),
      summary,
      analysis,
      // Enhanced report metadata
      metadata: {
        generatedBy: 'GitIntegratedProgressService',
        version: '2.0.0',
        includesSavingsAnalysis: !!analysis.savings,
        savingsConfidence: analysis.savings?.confidence || 0,
        savingsCalculationSucceeded: analysis.savings?.calculationSucceeded || false
      },
      // Executive summary for quick access
      executiveSummary: analysis.savings?.calculationSucceeded ? {
        totalSavings: {
          dollars: Math.round(analysis.savings.calculation.savings.dollars),
          hours: Math.round(analysis.savings.calculation.savings.hours),
          weeks: Math.round(analysis.savings.calculation.savings.weeks),
          percentage: Math.round(analysis.savings.calculation.savings.percentage)
        },
        efficiency: {
          productivityMultiplier: analysis.savings.summary.efficiency.productivityMultiplier,
          costEfficiency: analysis.savings.summary.efficiency.costEfficiency
        },
        confidence: analysis.savings.confidence
      } : null
    };
    
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`[GitProgress] Comprehensive report saved to ${reportPath}`);
    
    // Also save a simplified savings summary file if analysis succeeded
    if (analysis.savings?.calculationSucceeded) {
      const savingsPath = path.join(reportsDir, `savings-summary-${timestamp}.json`);
      const savingsSummary = {
        timestamp: new Date().toISOString(),
        dateRange: analysis.dateRange,
        totalSavings: report.executiveSummary?.totalSavings,
        topOpportunities: analysis.savings.summary.topOpportunities.slice(0, 5),
        efficiency: report.executiveSummary?.efficiency,
        confidence: analysis.savings.confidence
      };
      
      await fs.writeFile(savingsPath, JSON.stringify(savingsSummary, null, 2));
      console.log(`[GitProgress] Savings summary saved to ${savingsPath}`);
    }
  }

  /**
   * Display formatted report with savings information to console
   */
  private displayReport(analysis: GitAnalysisResult, summary: string): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 CUMULATIVE DEVELOPMENT PROGRESS REPORT WITH SAVINGS ANALYSIS');
    console.log('='.repeat(80));
    console.log(`📅 Period: ${analysis.dateRange}`);
    console.log(`📈 Total Commits: ${analysis.totalCommits}`);
    console.log(`📁 Files Changed: ${analysis.fileStats.filesChanged}`);
    console.log(`➕ Lines Added: ${analysis.fileStats.additions}`);
    console.log(`➖ Lines Removed: ${analysis.fileStats.deletions}`);
    
    // Display prominent savings information if available
    if (analysis.savings?.calculationSucceeded && analysis.savings.confidence >= 50) {
      console.log('\n' + '💰'.repeat(40));
      console.log('💰 SAVINGS ANALYSIS HIGHLIGHTS');
      console.log('💰'.repeat(40));
      console.log(`💵 Total Savings: $${Math.round(analysis.savings.calculation.savings.dollars).toLocaleString()}`);
      console.log(`⏰ Time Saved: ${Math.round(analysis.savings.calculation.savings.hours)} hours (${Math.round(analysis.savings.calculation.savings.weeks)} weeks)`);
      console.log(`📊 Cost Reduction: ${Math.round(analysis.savings.calculation.savings.percentage)}%`);
      console.log(`🚀 Productivity Gain: ${analysis.savings.summary.efficiency.productivityMultiplier}x vs traditional`);
      console.log(`📈 ROI: ${analysis.savings.summary.totalSavings.roi}x`);
      console.log(`🎯 Confidence: ${Math.round(analysis.savings.confidence)}%`);
      
      // Show top savings opportunities
      if (analysis.savings.summary.topOpportunities.length > 0) {
        console.log('\n🏆 TOP SAVINGS OPPORTUNITIES:');
        analysis.savings.summary.topOpportunities.slice(0, 3).forEach((opportunity, index) => {
          console.log(`  ${index + 1}. ${opportunity.name}: $${Math.round(opportunity.savings).toLocaleString()} saved`);
        });
      }
      
      // Show top efficient feature clusters
      if (analysis.savings.topFeatures.length > 0) {
        console.log('\n⚡ MOST EFFICIENT FEATURES:');
        analysis.savings.topFeatures.slice(0, 3).forEach((feature, index) => {
          const efficiency = Math.round(feature.efficiency.velocityScore * 100);
          console.log(`  ${index + 1}. ${feature.cluster.name}: ${efficiency}% efficiency score`);
        });
      }
    } else if (analysis.savings?.calculationSucceeded === false) {
      console.log('\n⚠️  SAVINGS ANALYSIS: Unable to calculate (insufficient data or error)');
      if (analysis.savings.errorMessage) {
        console.log(`   Error: ${analysis.savings.errorMessage}`);
      }
    }
    
    console.log('\n📝 SUMMARY:');
    console.log(summary);
    console.log('\n🏗️ DEVELOPMENT CATEGORIES:');
    
    analysis.categories.forEach(category => {
      console.log(`  • ${category.name}: ${category.commits.length} commits`);
    });
    
    console.log('\n👥 TOP CONTRIBUTORS:');
    analysis.topContributors.forEach((contributor, index) => {
      console.log(`  ${index + 1}. ${contributor.author}: ${contributor.commits} commits`);
    });
    
    console.log('='.repeat(80) + '\n');
  }

  /**
   * Get git repository status using secure simple-git API
   */
  public async getGitStatus(): Promise<string> {
    try {
      const status = await this.git.status();
      
      if (status.files.length === 0) {
        return 'Working directory clean';
      }
      
      // Format status similar to git status --porcelain
      const statusLines = status.files.map(file => {
        const modType = file.index === '?' ? '??' : file.index + file.working_dir;
        return `${modType} ${file.path}`;
      });
      
      return statusLines.join('\n');
    } catch (error) {
      console.warn('[GitProgress] Could not get git status:', error);
      return 'Could not determine git status';
    }
  }

  /**
   * Get current branch information using secure simple-git API
   */
  public async getCurrentBranch(): Promise<string> {
    try {
      const status = await this.git.status();
      return status.current || 'Unknown branch';
    } catch (error) {
      console.warn('[GitProgress] Could not get current branch:', error);
      return 'Unknown branch';
    }
  }
}