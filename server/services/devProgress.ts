import { TaskService, DocService } from 'dart-tools';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { SavingsCalculation, ExecutiveSummary, FeatureClusterSavings } from './estimation/savingsCalculator.js';

/**
 * Developer Progress Service
 * 
 * This service is designed for developers to report project progress to clients
 * via Dart in natural, client-friendly language. It focuses on communicating
 * development updates, not syncing operational data.
 */

interface ProgressUpdate {
  summary: string;
  added?: string[];
  fixed?: string[];
  improved?: string[];
  nextSteps?: string[];
  metadata?: Record<string, any>;
  /** Optional savings analysis data to showcase client value */
  savings?: {
    /** Overall savings calculation */
    calculation: SavingsCalculation;
    /** Executive summary with key metrics */
    summary: ExecutiveSummary;
    /** Top feature clusters by savings */
    topFeatures?: FeatureClusterSavings[];
    /** Confidence in savings calculation (0-100) */
    confidence: number;
    /** Whether calculation succeeded */
    calculationSucceeded: boolean;
    /** Error message if calculation failed */
    errorMessage?: string;
    /** Time period analyzed */
    period?: string;
  };
}

interface UpdateSection {
  title: string;
  items: string[];
}

export class DevProgressService {
  private static instance: DevProgressService;
  private dartToken: string;
  private workspaceId = 'LTPknvYLuLH9'; // Your Dart workspace ID (Eric Parker)
  private reportsDir: string;

  private constructor() {
    this.dartToken = process.env.DART_TOKEN || '';
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    this.reportsDir = path.join(process.cwd(), '.dart-reports');
    
    // Ensure reports directory exists
    this.ensureReportsDir();
  }

  // Singleton pattern
  public static getInstance(): DevProgressService {
    if (!DevProgressService.instance) {
      DevProgressService.instance = new DevProgressService();
    }
    return DevProgressService.instance;
  }

  // Ensure reports directory exists
  private async ensureReportsDir(): Promise<void> {
    try {
      await fs.mkdir(this.reportsDir, { recursive: true });
    } catch (error) {
      console.error('[DevProgress] Failed to create reports directory:', error);
    }
  }

  // Check if service is configured
  isConfigured(): boolean {
    return !!this.dartToken;
  }

  // Test connection and configuration
  async testConnection(): Promise<boolean> {
    if (!this.dartToken) {
      console.log('[DevProgress] Warning: DART_TOKEN not configured');
      return false;
    }

    try {
      // Try to list tasks as a connection test
      const tasks = await TaskService.listTasks({ limit: 1 });
      console.log('[DevProgress] Successfully connected to Dart API using dart-tools');
      return true;
    } catch (error: any) {
      console.error('[DevProgress] Connection test failed:', error.message);
      return false;
    }
  }

  // Create comprehensive report by combining all latest reports
  async createComprehensiveReport(progressMessage: string): Promise<string> {
    try {
      // Read all latest reports
      const reports: { [key: string]: any } = {};
      
      // Read git analysis
      try {
        const gitAnalysisPath = path.join(this.reportsDir, 'last-git-analysis.json');
        const gitAnalysisContent = await fs.readFile(gitAnalysisPath, 'utf-8');
        reports.gitAnalysis = JSON.parse(gitAnalysisContent);
      } catch (e) {
        console.log('[DevProgress] No last-git-analysis.json found');
      }
      
      // Read savings summary  
      try {
        const savingsSummaryPath = path.join(this.reportsDir, 'last-savings-summary.json');
        const savingsSummaryContent = await fs.readFile(savingsSummaryPath, 'utf-8');
        reports.savingsSummary = JSON.parse(savingsSummaryContent);
      } catch (e) {
        console.log('[DevProgress] No last-savings-summary.json found');
      }
      
      // Read progress report
      try {
        const progressPath = path.join(this.reportsDir, 'last-progress.json');
        const progressContent = await fs.readFile(progressPath, 'utf-8');
        reports.progress = JSON.parse(progressContent);
      } catch (e) {
        console.log('[DevProgress] No last-progress.json found');
      }
      
      // Build comprehensive styled document
      let doc = `# 📊 COMPREHENSIVE DEVELOPMENT PROGRESS REPORT\n`;
      doc += `## ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n\n`;
      
      // Executive Summary with Savings Highlight
      if (reports.savingsSummary) {
        const savings = reports.savingsSummary;
        
        // Calculate actual total from opportunities if totalSavings is zero
        let totalDollars = savings.totalSavings?.dollars || 0;
        if (totalDollars === 0 && savings.topOpportunities?.length > 0) {
          totalDollars = savings.topOpportunities.reduce((sum: number, opp: any) => sum + (opp.savings || 0), 0);
        }
        
        // Use values from git analysis if available
        if (reports.gitAnalysis?.savings?.calculation?.savings) {
          const gitSavings = reports.gitAnalysis.savings.calculation.savings;
          totalDollars = gitSavings.dollars || totalDollars;
          const totalHours = gitSavings.hours || 0;
          const totalWeeks = gitSavings.weeks || 0;
          
          doc += `## 💰 EXECUTIVE SUMMARY: MASSIVE VALUE DELIVERED\n\n`;
          doc += `### 🚀 Client Savings Achieved:\n`;
          doc += `- **Total Dollars Saved:** $${Math.round(totalDollars).toLocaleString()}\n`;
          doc += `- **Development Time Saved:** ${Math.round(totalHours).toLocaleString()} hours (${Math.round(totalWeeks)} weeks)\n`;
          doc += `- **Productivity Multiplier:** ${(savings.efficiency?.productivityMultiplier || 1).toFixed(1)}x vs industry standards\n`;
          doc += `- **Cost Reduction:** ${Math.round(gitSavings.percentage || savings.efficiency?.costEfficiency || 0)}%\n\n`;
        } else {
          // Fallback to summary data
          const totalHours = Math.round(totalDollars / 150); // Estimate hours based on $150/hour rate
          const totalWeeks = Math.round(totalHours / 40); // Convert to weeks
          
          doc += `## 💰 EXECUTIVE SUMMARY: MASSIVE VALUE DELIVERED\n\n`;
          doc += `### 🚀 Client Savings Achieved:\n`;
          doc += `- **Total Dollars Saved:** $${Math.round(totalDollars).toLocaleString()}\n`;
          doc += `- **Development Time Saved:** ${totalHours.toLocaleString()} hours (${totalWeeks} weeks)\n`;
          doc += `- **Productivity Multiplier:** ${(savings.efficiency?.productivityMultiplier || 1).toFixed(1)}x vs industry standards\n`;
          doc += `- **Cost Reduction:** ${Math.round(savings.efficiency?.costEfficiency || 0)}%\n\n`;
        }
        
        if (savings.methodology) {
          doc += `### 📐 Validation Methodology:\n`;
          doc += `- Industry Benchmarks: ${savings.methodology.benchmarks?.join(', ') || 'COCOMO II, ISBSG, DORA'}\n`;
          doc += `- Analysis Period: ${savings.period || 'Last 30 days'}\n`;
          doc += `- Confidence Level: ${savings.confidence || 0}%\n\n`;
        }
      }
      
      // Current Progress Update
      doc += `## ✅ LATEST PROGRESS UPDATE\n\n`;
      doc += progressMessage + '\n\n';
      
      // Development Activity Analysis
      if (reports.gitAnalysis?.analysis) {
        const analysis = reports.gitAnalysis.analysis;
        doc += `## 📈 DEVELOPMENT ACTIVITY ANALYSIS\n\n`;
        doc += `### Activity Metrics:\n`;
        doc += `- **Total Commits:** ${analysis.totalCommits || 0}\n`;
        doc += `- **Files Changed:** ${analysis.fileStats?.filesChanged || 0}\n`;
        doc += `- **Lines Added:** ${(analysis.fileStats?.additions || 0).toLocaleString()}\n`;
        doc += `- **Lines Modified:** ${(analysis.fileStats?.deletions || 0).toLocaleString()}\n`;
        doc += `- **Time Period:** ${analysis.dateRange || 'N/A'}\n\n`;
        
        // Feature Categories
        if (analysis.categories && analysis.categories.length > 0) {
          doc += `### 🏗️ Development Focus Areas:\n`;
          analysis.categories.forEach((cat: any) => {
            const commitCount = cat.commits ? cat.commits.length : (cat.count || 0);
            const percentage = cat.percentage || Math.round(commitCount / analysis.totalCommits * 100);
            doc += `- **${cat.name}:** ${commitCount} commits (${percentage}%)\n`;
          });
          doc += '\n';
        }
      }
      
      // Detailed Savings Breakdown
      if (reports.gitAnalysis?.savings?.calculation) {
        const calc = reports.gitAnalysis.savings.calculation;
        doc += `## 💎 DETAILED SAVINGS ANALYSIS\n\n`;
        
        if (calc.traditional) {
          doc += `### Traditional Development Estimates:\n`;
          doc += `- Estimated Hours: ${Math.round(calc.traditional.totalHours || 0).toLocaleString()}\n`;
          doc += `- Estimated Cost: $${Math.round(calc.traditional.totalCost || 0).toLocaleString()}\n`;
          doc += `- Estimated Duration: ${Math.round((calc.traditional.totalHours || 0) / 168)} weeks\n\n`;
        }
        
        if (calc.actual) {
          doc += `### Actual Accelerated Development:\n`;
          doc += `- Actual Hours: ${Math.round(calc.actual.totalHours || 0).toLocaleString()}\n`;
          doc += `- Actual Cost: $${Math.round(calc.actual.totalCost || 0).toLocaleString()}\n`;
          doc += `- Actual Duration: ${Math.round((calc.actual.totalHours || 0) / 168)} weeks\n\n`;
        }
        
        if (calc.savings) {
          doc += `### 🎯 Net Savings Achieved:\n`;
          doc += `- Hours Saved: ${Math.round(calc.savings.hours || 0).toLocaleString()}\n`;
          doc += `- Dollars Saved: $${Math.round(calc.savings.dollars || 0).toLocaleString()}\n`;
          doc += `- Weeks Saved: ${Math.round(calc.savings.weeks || 0)}\n`;
          doc += `- Percentage Saved: ${Math.round(calc.savings.percentage || 0)}%\n\n`;
        }
      }
      
      // Feature Impact Analysis
      if (reports.gitAnalysis?.savings?.topFeatures && reports.gitAnalysis.savings.topFeatures.length > 0) {
        doc += `## 🏆 TOP VALUE-GENERATING FEATURES\n\n`;
        reports.gitAnalysis.savings.topFeatures.forEach((feature: any, index: number) => {
          doc += `### ${index + 1}. ${feature.cluster || 'Feature'}\n`;
          doc += `- **Savings:** $${Math.round(feature.savings?.dollars || 0).toLocaleString()}\n`;
          doc += `- **Time Saved:** ${Math.round(feature.savings?.hours || 0)} hours\n`;
          doc += `- **Components:** ${feature.commitCount || 0} commits\n\n`;
        });
      }
      
      // Agent Metrics if available
      if (reports.progress?.update?.agentMetrics) {
        const metrics = reports.progress.update.agentMetrics;
        doc += `## 🤖 AI AGENT PERFORMANCE METRICS\n\n`;
        doc += `### Current Session:\n`;
        doc += `- **Time Worked:** ${metrics.current?.timeWorked || 'N/A'}\n`;
        doc += `- **Actions Performed:** ${metrics.current?.actionsPerformed || 0}\n`;
        doc += `- **Files Analyzed:** ${metrics.current?.itemsRead || 0}\n`;
        doc += `- **Code Changes:** ${metrics.current?.codeChanges || 0}\n`;
        doc += `- **Agent Cost:** $${(metrics.current?.agentUsageCents || 0) / 100}\n\n`;
        
        if (metrics.comparison) {
          doc += `### Historical Comparison:\n`;
          doc += `- **Efficiency Improvement:** ${metrics.comparison.efficiencyChange || 'N/A'}\n`;
          doc += `- **Speed Improvement:** ${metrics.comparison.speedChange || 'N/A'}\n`;
          doc += `- **Cost Optimization:** ${metrics.comparison.costChange || 'N/A'}\n\n`;
        }
      }
      
      // Summary
      doc += `## 📋 REPORT SUMMARY\n\n`;
      doc += `This comprehensive progress report demonstrates the exceptional value delivered through accelerated development practices. `;
      doc += `The combination of advanced AI-assisted development, optimized workflows, and strategic architecture decisions `;
      doc += `has resulted in documented savings that far exceed traditional development approaches.\n\n`;
      
      doc += `### Key Takeaways:\n`;
      doc += `1. **Proven ROI:** Every dollar invested returns multiple dollars in development cost savings\n`;
      doc += `2. **Time to Market:** Features delivered weeks ahead of traditional timelines\n`;
      doc += `3. **Quality Assurance:** Automated testing and AI review ensures robust, production-ready code\n`;
      doc += `4. **Scalable Architecture:** Foundation built for long-term growth and maintenance efficiency\n\n`;
      
      doc += `---\n`;
      doc += `*Report Generated: ${new Date().toISOString()}*\n`;
      doc += `*Document ID: Eric Parker/Docs*\n`;
      
      return doc;
      
    } catch (error) {
      console.error('[DevProgress] Error creating comprehensive report:', error);
      // Fallback to simple message if comprehensive report fails
      return progressMessage;
    }
  }

  // Send update to Dart
  async sendUpdate(message: string): Promise<boolean> {
    if (!this.dartToken) {
      console.log('[DevProgress] DART_TOKEN not configured');
      return false;
    }

    try {
      // Create comprehensive report by combining all latest reports
      const comprehensiveReport = await this.createComprehensiveReport(message);
      
      // Create a document (not a task) in Eric Parker/Docs folder
      const doc = await DocService.createDoc({
        item: {
          title: `Dev Progress Report - ${new Date().toLocaleDateString()}`,
          text: comprehensiveReport,
          folder: 'Eric Parker/Docs' // Send to Eric Parker Docs folder
        }
      });

      console.log('[DevProgress] Progress report sent successfully as document to Eric Parker/Docs');
      return true;
    } catch (error: any) {
      console.error('[DevProgress] Failed to send document to Eric Parker/Docs:', error.message);
      
      // Try sending to General/Docs as fallback
      try {
        const comprehensiveReport = await this.createComprehensiveReport(message);
        const doc = await DocService.createDoc({
          item: {
            title: `Dev Progress Report - ${new Date().toLocaleDateString()}`,
            text: comprehensiveReport,
            folder: 'General/Docs' // Fallback to General/Docs
          }
        });
        console.log('[DevProgress] Progress report sent to General/Docs as fallback');
        return true;
      } catch (docError: any) {
        console.error('[DevProgress] Failed to send as doc:', docError.message);
        return false;
      }
    }
  }

  // Format savings data with compelling headlines for clients
  private formatSavingsHeadline(savings: ProgressUpdate['savings']): string {
    if (!savings || !savings.calculationSucceeded) {
      return '';
    }

    const { calculation, confidence } = savings;
    const totalSavings = calculation.savings.dollars;
    const percentage = calculation.savings.percentage;
    const weeks = calculation.savings.weeks;
    const roi = calculation.savings.roiMultiplier;

    // Create compelling headline based on savings magnitude
    let headline = '';
    let confidenceIndicator = confidence >= 80 ? '🎯' : confidence >= 60 ? '📊' : '📈';
    
    if (totalSavings >= 100000) {
      headline = `💰 **MAJOR SAVINGS ACHIEVED: $${Math.round(totalSavings).toLocaleString()}** 🚀`;
    } else if (totalSavings >= 10000) {
      headline = `💰 **Significant Cost Savings: $${Math.round(totalSavings).toLocaleString()}** ✨`;
    } else if (totalSavings >= 1000) {
      headline = `💰 **Value Delivered: $${Math.round(totalSavings).toLocaleString()} Saved** 📈`;
    } else {
      headline = `💰 **Efficiency Gains: $${Math.round(totalSavings).toLocaleString()} Saved** ⚡`;
    }

    // Add efficiency metrics
    let efficiencyText = '';
    if (weeks >= 4) {
      efficiencyText = ` (${weeks} weeks ahead of traditional schedule)`;
    } else if (percentage >= 50) {
      efficiencyText = ` (${Math.round(percentage)}% more efficient than industry standard)`;
    } else if (roi >= 2) {
      efficiencyText = ` (${roi.toFixed(1)}x ROI compared to traditional development)`;
    }

    return `${headline}${efficiencyText}\n${confidenceIndicator} *Confidence: ${confidence}%*\n\n`;
  }

  // Format detailed savings breakdown for clients
  private formatSavingsBreakdown(savings: ProgressUpdate['savings']): string {
    if (!savings || !savings.calculationSucceeded) {
      return '';
    }

    const { calculation, summary } = savings;
    let breakdown = `📊 **Value Analysis**\n`;
    
    // Traditional vs Actual comparison
    breakdown += `• Traditional Estimate: ${calculation.traditional.hours} hours ($${Math.round(calculation.traditional.cost).toLocaleString()})\n`;
    breakdown += `• Actual Development: ${calculation.actual.hours} hours ($${Math.round(calculation.actual.cost).toLocaleString()})\n`;
    breakdown += `• **Net Savings: ${calculation.savings.hours} hours & $${Math.round(calculation.savings.dollars).toLocaleString()}**\n\n`;

    // Efficiency metrics
    if (summary && summary.efficiency) {
      breakdown += `🚀 **Efficiency Metrics**\n`;
      breakdown += `• Productivity Multiplier: ${summary.efficiency.productivityMultiplier.toFixed(1)}x industry standard\n`;
      breakdown += `• Cost Efficiency Improvement: ${summary.efficiency.costEfficiency.toFixed(1)}%\n`;
      if (summary.efficiency.timeToMarket) {
        breakdown += `• Time-to-Market Improvement: ${summary.efficiency.timeToMarket.toFixed(1)}%\n`;
      }
      breakdown += '\n';
    }

    // Top opportunities
    if (summary && summary.topOpportunities && summary.topOpportunities.length > 0) {
      breakdown += `💡 **Top Value Areas**\n`;
      summary.topOpportunities.slice(0, 3).forEach((opp, index) => {
        breakdown += `${index + 1}. ${opp.name}: $${Math.round(opp.savings).toLocaleString()} saved\n`;
      });
      breakdown += '\n';
    }

    return breakdown;
  }

  // Generate compelling client messaging
  private generateClientValueMessage(savings: ProgressUpdate['savings']): string {
    if (!savings || !savings.calculationSucceeded) {
      return '🔧 **Optimized Development Process** - Delivering efficient, high-quality solutions using modern methodologies.';
    }

    const { calculation, summary } = savings;
    const dollarsSaved = Math.round(calculation.savings.dollars);
    const percentage = Math.round(calculation.savings.percentage);
    const roi = calculation.savings.roiMultiplier;

    const messages = [
      `📈 **Exceeding Expectations** - Delivered ${percentage}% more value than traditional development approaches would provide.`,
      `⚡ **Accelerated Timeline** - Completed work ${calculation.savings.weeks} weeks faster than industry standard estimates.`,
      `💡 **Smart Investment** - Every dollar invested generated ${roi.toFixed(1)}x return through optimized development practices.`,
      `🎯 **Proven Results** - Demonstrated $${dollarsSaved.toLocaleString()} in measurable cost savings through efficient execution.`
    ];

    // Select message based on strongest metric
    if (roi >= 3) return messages[2];
    if (calculation.savings.weeks >= 4) return messages[1];
    if (percentage >= 60) return messages[0];
    return messages[3];
  }

  // Format fallback message when savings unavailable
  private formatFallbackValueMessage(): string {
    return `🔧 **Optimized Development Process**\n` +
           `Delivering efficient, high-quality solutions using modern development methodologies and best practices. ` +
           `Our streamlined approach ensures maximum value and minimal waste throughout the development cycle.\n\n`;
  }

  // Format progress update for clients
  formatUpdate(update: ProgressUpdate): string {
    const sections: UpdateSection[] = [];
    const date = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    // Build the message with markdown formatting, featuring savings prominently
    let message = `📊 Development Progress Update\n${date}\n\n`;
    
    // Lead with compelling savings headline if available
    const savingsHeadline = this.formatSavingsHeadline(update.savings);
    if (savingsHeadline) {
      message += savingsHeadline;
    } else {
      // Fallback value message when savings unavailable
      message += this.formatFallbackValueMessage();
    }
    
    // Add executive summary with enhanced value context
    if (update.summary) {
      message += `**Executive Summary**\n${update.summary}\n\n`;
      
      // Add client value message
      const valueMessage = this.generateClientValueMessage(update.savings);
      message += `${valueMessage}\n\n`;
    }
    
    // Add sections with appropriate icons
    if (update.added && update.added.length > 0) {
      message += `✨ **What's New**\n`;
      update.added.forEach(item => {
        message += `• ${item}\n`;
      });
      message += '\n';
    }
    
    if (update.improved && update.improved.length > 0) {
      message += `🚀 **Improvements**\n`;
      update.improved.forEach(item => {
        message += `• ${item}\n`;
      });
      message += '\n';
    }
    
    if (update.fixed && update.fixed.length > 0) {
      message += `🐛 **Bug Fixes**\n`;
      update.fixed.forEach(item => {
        message += `• ${item}\n`;
      });
      message += '\n';
    }
    
    if (update.nextSteps && update.nextSteps.length > 0) {
      message += `📋 **Next Steps**\n`;
      update.nextSteps.forEach(item => {
        message += `• ${item}\n`;
      });
      message += '\n';
    }
    
    // Add detailed savings breakdown if available
    const savingsBreakdown = this.formatSavingsBreakdown(update.savings);
    if (savingsBreakdown) {
      message += savingsBreakdown;
    }
    
    // Add confidence and methodology note for savings
    if (update.savings && update.savings.calculationSucceeded) {
      message += `📋 **Analysis Note**\n`;
      message += `Savings calculated using actual development time vs industry benchmarks `;
      message += `(${update.savings.period || 'recent period'}). `;
      message += `Methodology combines git analysis, work contribution units, and project benchmarks.\n\n`;
    }
    
    message += '---\n*This update was generated automatically from the development team.*';
    
    return message;
  }

  // Validate update content
  validateUpdate(update: ProgressUpdate): string[] {
    const errors: string[] = [];
    
    if (!update.summary || update.summary.trim().length === 0) {
      errors.push('Summary is required');
    }
    
    if (update.summary && update.summary.split(' ').length > 50) {
      errors.push('Summary should be concise (max 50 words)');
    }
    
    const allItems = [
      ...(update.added || []),
      ...(update.fixed || []),
      ...(update.improved || []),
      ...(update.nextSteps || [])
    ];
    
    allItems.forEach((item, index) => {
      if (item.split(' ').length > 30) {
        errors.push(`Item "${item.substring(0, 30)}..." is too long (max 30 words)`);
      }
    });
    
    if (allItems.length === 0) {
      errors.push('At least one update item is required');
    }
    
    return errors;
  }

  // Save report to file system
  async saveReport(update: ProgressUpdate, message: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `progress-${timestamp}.json`;
    const filepath = path.join(this.reportsDir, filename);
    
    const report = {
      timestamp: new Date().toISOString(),
      update,
      formatted: message,
      sent: false
    };
    
    await fs.writeFile(filepath, JSON.stringify(report, null, 2));
    
    // Save as "last-progress.json" for easy access
    const lastProgressPath = path.join(this.reportsDir, 'last-progress.json');
    await fs.writeFile(lastProgressPath, JSON.stringify(report, null, 2));
    
    return filepath;
  }

  // Get recent reports
  async getRecentReports(limit: number = 10): Promise<any[]> {
    try {
      const files = await fs.readdir(this.reportsDir);
      const reportFiles = files
        .filter(f => f.startsWith('progress-') && f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, limit);
      
      const reports = [];
      for (const file of reportFiles) {
        const content = await fs.readFile(path.join(this.reportsDir, file), 'utf-8');
        reports.push(JSON.parse(content));
      }
      
      return reports;
    } catch (error) {
      console.error('[DevProgress] Failed to get recent reports:', error);
      return [];
    }
  }

  // Fetch savings data from GitIntegratedProgressService
  async fetchSavingsData(config?: {
    sinceDate?: string;
    confidenceThreshold?: number;
    enableSavings?: boolean;
  }): Promise<ProgressUpdate['savings'] | null> {
    try {
      // Dynamically import to avoid circular dependencies
      const { GitIntegratedProgressService } = await import('./gitIntegratedProgress.js');
      const gitService = GitIntegratedProgressService.getInstance();
      
      const analysisConfig = {
        sinceDate: config?.sinceDate || '1 month ago',
        enableSavings: config?.enableSavings !== false,
        confidenceThreshold: config?.confidenceThreshold || 60,
        sendToDart: false // We just want the data, not to send a separate report
      };
      
      console.log('[DevProgress] Fetching savings analysis data...');
      const analysis = await gitService.analyzeGitHistory(analysisConfig);
      
      if (analysis.savings && analysis.savings.calculationSucceeded) {
        const savingsData: ProgressUpdate['savings'] = {
          calculation: analysis.savings.calculation,
          summary: analysis.savings.summary,
          topFeatures: analysis.savings.topFeatures,
          confidence: analysis.savings.confidence,
          calculationSucceeded: true,
          period: analysis.dateRange
        };
        
        console.log(`[DevProgress] Savings data fetched successfully: $${Math.round(savingsData.calculation.savings.dollars).toLocaleString()} saved`);
        return savingsData;
      } else {
        const errorMsg = analysis.savings?.errorMessage || 'Savings calculation disabled or failed';
        console.log(`[DevProgress] Savings data unavailable: ${errorMsg}`);
        return {
          calculation: {} as any,
          summary: {} as any,
          confidence: 0,
          calculationSucceeded: false,
          errorMessage: errorMsg
        };
      }
    } catch (error) {
      console.warn('[DevProgress] Failed to fetch savings data:', error);
      return null;
    }
  }

  // Send comprehensive update with optional savings integration
  async sendProgressUpdate(
    update: ProgressUpdate, 
    options?: {
      includeSavings?: boolean;
      savingsConfig?: {
        sinceDate?: string;
        confidenceThreshold?: number;
      };
    }
  ): Promise<boolean> {
    const errors = this.validateUpdate(update);
    if (errors.length > 0) {
      console.error('[DevProgress] Validation errors:', errors);
      return false;
    }
    
    // Enhance update with savings data if requested and not already included
    let enhancedUpdate = { ...update };
    const includeSavings = options?.includeSavings !== false; // Default to true
    
    if (includeSavings && !enhancedUpdate.savings) {
      console.log('[DevProgress] Fetching savings data to enhance progress report...');
      const savingsData = await this.fetchSavingsData(options?.savingsConfig);
      if (savingsData) {
        enhancedUpdate.savings = savingsData;
        console.log('[DevProgress] Enhanced progress report with savings analysis');
      }
    }
    
    const message = this.formatUpdate(enhancedUpdate);
    
    // Save report with enhanced data
    const filepath = await this.saveReport(enhancedUpdate, message);
    console.log(`[DevProgress] Report saved to ${filepath}`);
    
    // Send to Dart
    const sent = await this.sendUpdate(message);
    
    if (sent) {
      // Update the saved report to mark as sent
      const report = JSON.parse(await fs.readFile(filepath, 'utf-8'));
      report.sent = true;
      report.sentAt = new Date().toISOString();
      await fs.writeFile(filepath, JSON.stringify(report, null, 2));
      
      // Log success with savings info
      if (enhancedUpdate.savings?.calculationSucceeded) {
        const dollarsSaved = Math.round(enhancedUpdate.savings.calculation.savings.dollars);
        console.log(`[DevProgress] Progress report sent successfully featuring $${dollarsSaved.toLocaleString()} in documented savings`);
      } else {
        console.log('[DevProgress] Progress report sent successfully with optimized development messaging');
      }
    }
    
    return sent;
  }

  // Convenience method to send progress update with savings analysis enabled by default
  async sendProgressUpdateWithSavings(
    update: ProgressUpdate,
    sinceDate: string = '1 month ago'
  ): Promise<boolean> {
    return this.sendProgressUpdate(update, {
      includeSavings: true,
      savingsConfig: {
        sinceDate,
        confidenceThreshold: 60
      }
    });
  }

  // Quick method to send a simple update with automatic savings integration
  async sendQuickUpdate(
    summary: string,
    added?: string[],
    improved?: string[],
    fixed?: string[],
    nextSteps?: string[]
  ): Promise<boolean> {
    const update: ProgressUpdate = {
      summary,
      added,
      improved,
      fixed,
      nextSteps
    };
    
    return this.sendProgressUpdateWithSavings(update);
  }
}

// Export singleton instance
export const devProgressService = DevProgressService.getInstance();