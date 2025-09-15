import { TaskService, DocService } from 'dart-tools';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { SavingsCalculation, ExecutiveSummary, FeatureClusterSavings } from '../estimation/savingsCalculator.js';
import { GitIntegratedProgressService } from '../git/gitIntegration.js';
import { RPMConfig } from '../types.js';

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
  savings?: {
    calculation: SavingsCalculation;
    summary: ExecutiveSummary;
    topFeatures?: FeatureClusterSavings[];
    confidence: number;
    calculationSucceeded: boolean;
    errorMessage?: string;
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
  private workspaceId: string;
  private dartboard: string;
  private reportsDir: string;
  private gitService?: GitIntegratedProgressService;

  private constructor(config: RPMConfig = {}) {
    this.dartToken = config.dartToken || process.env.DART_TOKEN || '';
    this.workspaceId = config.workspaceId || process.env.DART_WORKSPACE_ID || '';
    this.dartboard = config.dartboard || process.env.DART_DARTBOARD || 'Tasks';
    this.reportsDir = config.reportsDir || path.join(process.cwd(), '.dart-reports');
    
    // Ensure reports directory exists
    this.ensureReportsDir();
  }

  // Singleton pattern with configuration
  public static getInstance(config?: RPMConfig): DevProgressService {
    if (!DevProgressService.instance) {
      DevProgressService.instance = new DevProgressService(config);
    }
    return DevProgressService.instance;
  }

  // Configure the service
  public configure(config: RPMConfig): void {
    if (config.dartToken) this.dartToken = config.dartToken;
    if (config.workspaceId) this.workspaceId = config.workspaceId;
    if (config.dartboard) this.dartboard = config.dartboard;
    if (config.reportsDir) this.reportsDir = config.reportsDir;
  }

  // Set git service for savings integration
  public setGitService(gitService: GitIntegratedProgressService): void {
    this.gitService = gitService;
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

  // Send update to Dart
  async sendUpdate(message: string): Promise<boolean> {
    if (!this.dartToken) {
      console.log('[DevProgress] DART_TOKEN not configured');
      return false;
    }

    try {
      // Create a task with the progress update using dart-tools
      const task = await TaskService.createTask({
        item: {
          title: `Dev Progress - ${new Date().toLocaleDateString()}`,
          description: message,
          status: 'Done', // Mark as done since it's a completed progress update
          dartboard: this.dartboard,
        }
      });

      console.log('[DevProgress] Progress update sent successfully as task');
      return true;
    } catch (error: any) {
      console.error('[DevProgress] Failed to send update as task:', error.message);
      
      // Try sending as a doc if task creation fails
      try {
        const doc = await DocService.createDoc({
          item: {
            title: `Dev Progress - ${new Date().toLocaleDateString()}`,
            description: message,
            dartboard: this.dartboard,
          }
        });
        
        console.log('[DevProgress] Progress update sent successfully as document');
        return true;
      } catch (docError: any) {
        console.error('[DevProgress] Failed to send update as document:', docError.message);
        return false;
      }
    }
  }

  /**
   * Send comprehensive progress update with optional savings analysis
   */
  async sendProgressUpdate(update: ProgressUpdate): Promise<boolean> {
    try {
      // Try to fetch savings data if git service is available and not already provided
      if (!update.savings && this.gitService) {
        try {
          console.log('[DevProgress] Fetching savings data to enhance progress report...');
          const savingsData = await this.fetchSavingsData();
          if (savingsData) {
            update.savings = savingsData;
          }
        } catch (error) {
          console.error('[DevProgress] Failed to fetch savings data:', error);
          // Continue without savings data
        }
      }

      // Save report locally
      await this.saveProgressReport(update);

      // Format message for Dart
      const message = this.formatProgressMessage(update);

      // Send to Dart
      const success = await this.sendUpdate(message);
      
      if (success) {
        console.log('[DevProgress] Progress report sent successfully with' + 
          (update.savings?.calculationSucceeded ? ' savings analysis' : ' optimized development messaging'));
      }
      
      return success;
    } catch (error) {
      console.error('[DevProgress] Error sending progress update:', error);
      return false;
    }
  }

  /**
   * Fetch savings data from git analysis
   */
  private async fetchSavingsData(period: string = '1 month ago'): Promise<any> {
    if (!this.gitService) return null;
    
    try {
      console.log('[DevProgress] Fetching savings analysis data...');
      const analysis = await this.gitService.analyzeGitHistory(period, { enableSavings: true });
      
      if (analysis.savings?.calculationSucceeded) {
        return analysis.savings;
      } else {
        console.log('[DevProgress] Savings calculation not available or below confidence threshold');
        return null;
      }
    } catch (error) {
      console.error('[DevProgress] Error fetching savings data:', error);
      return null;
    }
  }

  /**
   * Format progress message for Dart AI
   */
  private formatProgressMessage(update: ProgressUpdate): string {
    let message = `📊 Development Progress Update\n${new Date().toLocaleDateString()}\n\n`;

    // Add Replit Agent metrics if available
    if (update.agentMetrics) {
      const { totalTimeWorked, totalWorkDone, totalItemsRead, totalCodeChanged, totalAgentUsage, averagePerCommit } = update.agentMetrics;
      
      message += `**🤖 Replit Agent Performance Metrics:**\n`;
      message += `• Time Worked: ${Math.round(totalTimeWorked / 60)} hours (${totalTimeWorked} minutes)\n`;
      message += `• Work Done: ${totalWorkDone.toLocaleString()} actions performed\n`;
      message += `• Items Read: ${totalItemsRead.toLocaleString()} lines analyzed\n`;
      message += `• Code Changed: +${update.agentMetrics.totalCodeChanged || 0} lines\n`;
      message += `• Agent Usage: $${totalAgentUsage.toFixed(2)}\n`;
      
      if (averagePerCommit) {
        message += `\n**📈 Per-Commit Averages:**\n`;
        message += `• Time: ${averagePerCommit.timeWorked} minutes\n`;
        message += `• Actions: ${averagePerCommit.workDone}\n`;
        message += `• Cost: $${averagePerCommit.agentUsage.toFixed(2)}\n`;
      }
      message += `\n`;
    }

    // Add compelling savings headline if available
    if (update.savings?.calculationSucceeded) {
      const { calculation, summary } = update.savings;
      const savingsAmount = calculation?.savings?.dollars || 0;
      const weeksAhead = calculation?.savings?.weeks || 0;
      const roi = summary?.totalSavings?.roi || 0;
      const productivityMultiplier = summary?.efficiency?.productivityMultiplier || 1;

      if (savingsAmount >= 100000) {
        message += `💰 **MAJOR SAVINGS ACHIEVED: $${Math.round(savingsAmount).toLocaleString()}** 🚀\n`;
        message += `⚡ ${Math.round(weeksAhead)} weeks ahead of traditional timeline\n`;
        message += `📈 ${productivityMultiplier.toFixed(1)}x productivity multiplier vs industry standards\n\n`;
      } else if (savingsAmount >= 10000) {
        message += `💰 **Significant Cost Savings: $${Math.round(savingsAmount).toLocaleString()}** ✨\n`;
        message += `⏰ ${Math.round(weeksAhead)} weeks time advantage\n`;
        message += `🚀 ${productivityMultiplier.toFixed(1)}x efficiency vs traditional approaches\n\n`;
      } else if (savingsAmount >= 1000) {
        message += `💰 **Value Delivered: $${Math.round(savingsAmount).toLocaleString()} Saved** 📈\n`;
        message += `⚡ Accelerated delivery timeline\n\n`;
      }

      // Add detailed value analysis
      if (savingsAmount > 0) {
        const tradHours = calculation?.traditional?.hours || 0;
        const actualHours = calculation?.actual?.hours || 0;
        const netSavings = calculation?.savings?.hours || 0;
        
        message += `**📋 Value Analysis:**\n`;
        message += `• Traditional estimate: ${Math.round(tradHours)} hours ($${Math.round(calculation?.traditional?.cost || 0).toLocaleString()})\n`;
        message += `• Actual development: ${Math.round(actualHours)} hours ($${Math.round(calculation?.actual?.cost || 0).toLocaleString()})\n`;
        message += `• Net savings: ${Math.round(netSavings)} hours ($${Math.round(savingsAmount).toLocaleString()})\n`;
        
        if (roi > 1) {
          message += `• ROI: ${roi.toFixed(1)}x return on investment\n`;
        }
        
        if (weeksAhead > 1) {
          message += `• Time-to-market: ${Math.round(weeksAhead)} weeks ahead of industry estimates\n`;
        }
        
        message += `\n`;
      }

      // Add top value areas
      if (summary?.topValueAreas?.length > 0) {
        message += `**🎯 Top Value Areas:**\n`;
        summary.topValueAreas.slice(0, 3).forEach((area: any) => {
          message += `• ${area.category}: $${Math.round(area.savingsAmount).toLocaleString()} saved\n`;
        });
        message += `\n`;
      }

      // Add compelling client messaging
      if (savingsAmount > 1000) {
        if (roi > 2) {
          message += `🔧 **Client Value:** Every dollar invested generated ${roi.toFixed(1)}x return through optimized development processes.\n\n`;
        } else if (weeksAhead > 2) {
          message += `🔧 **Timeline Advantage:** Completed ${Math.round(weeksAhead)} weeks faster than industry estimates using modern development methodologies.\n\n`;
        } else if (calculation?.savings?.percentage > 20) {
          message += `🔧 **Efficiency Achievement:** Delivered ${Math.round(calculation.savings.percentage)}% more value than traditional development approaches.\n\n`;
        } else {
          message += `🔧 **Results Delivered:** Demonstrated $${Math.round(savingsAmount).toLocaleString()} in measurable cost savings through streamlined processes.\n\n`;
        }
      }

      // Add confidence and methodology note
      if (update.savings.confidence > 70) {
        message += `🎯 **Methodology:** Savings calculated using git analysis, work contribution units, and industry benchmarks (COCOMO II, ISBSG, DORA). Confidence: ${Math.round(update.savings.confidence)}%\n\n`;
      }
    } else {
      // Fallback messaging when savings not available
      message += `🔧 **Optimized Development Process**\n`;
      message += `Delivering efficient, high-quality solutions using modern development methodologies and best practices. Our streamlined approach ensures maximum value and minimal waste throughout the development cycle.\n\n`;
    }

    // Add main summary
    message += `**Executive Summary**\n${update.summary}\n\n`;

    // Add savings context when available
    if (update.savings?.calculationSucceeded) {
      message += `🔧 **Optimized Development Process** - Delivering efficient, high-quality solutions using modern methodologies.\n\n`;
    }

    // Add sections
    if (update.added && update.added.length > 0) {
      message += `✨ **What's New**\n`;
      update.added.forEach(item => message += `• ${item}\n`);
      message += `\n`;
    }

    if (update.improved && update.improved.length > 0) {
      message += `🚀 **Improvements**\n`;
      update.improved.forEach(item => message += `• ${item}\n`);
      message += `\n`;
    }

    if (update.fixed && update.fixed.length > 0) {
      message += `🐛 **Bug Fixes**\n`;
      update.fixed.forEach(item => message += `• ${item}\n`);
      message += `\n`;
    }

    if (update.nextSteps && update.nextSteps.length > 0) {
      message += `📋 **Next Steps**\n`;
      update.nextSteps.forEach(item => message += `• ${item}\n`);
      message += `\n`;
    }

    message += `---\n*This update was generated automatically from the development team.*`;

    return message;
  }

  /**
   * Save progress report to local storage
   */
  private async saveProgressReport(update: ProgressUpdate): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const reportPath = path.join(this.reportsDir, `progress-${timestamp}.json`);
      
      await fs.writeFile(reportPath, JSON.stringify(update, null, 2));
      
      // Save as "last-report.json" for easy access
      const lastReportPath = path.join(this.reportsDir, 'last-report.json');
      await fs.writeFile(lastReportPath, JSON.stringify(update, null, 2));
      
      // Also save as "last-progress.json" for consistency
      const lastProgressPath = path.join(this.reportsDir, 'last-progress.json');
      await fs.writeFile(lastProgressPath, JSON.stringify(update, null, 2));
      
      console.log(`[DevProgress] Report saved to ${reportPath}`);
    } catch (error) {
      console.error('[DevProgress] Failed to save report:', error);
    }
  }

  /**
   * Send progress update with savings data
   */
  async sendProgressUpdateWithSavings(
    summary: string,
    period: string = '1 month ago',
    additionalData: Partial<ProgressUpdate> = {}
  ): Promise<boolean> {
    const update: ProgressUpdate = {
      summary,
      ...additionalData
    };

    return this.sendProgressUpdate(update);
  }

  /**
   * Send a quick progress update
   */
  async sendQuickUpdate(summary: string, items: string[] = []): Promise<boolean> {
    const update: ProgressUpdate = {
      summary,
      improved: items
    };

    return this.sendProgressUpdate(update);
  }
}