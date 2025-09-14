import { TaskService, DocService } from 'dart-tools';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

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

  // Send update to Dart
  async sendUpdate(message: string): Promise<boolean> {
    if (!this.dartToken) {
      console.log('[DevProgress] DART_TOKEN not configured');
      return false;
    }

    try {
      // Create a task with the progress update using dart-tools
      // Need to specify the dartboard to send to the correct workspace
      const task = await TaskService.createTask({
        item: {
          title: `Dev Progress - ${new Date().toLocaleDateString()}`,
          description: message,
          status: 'Done', // Mark as done since it's a completed progress update
          dartboard: 'Eric Parker/Tasks', // Send to Eric Parker workspace
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
            text: message,
          }
        });
        console.log('[DevProgress] Progress update sent successfully as doc');
        return true;
      } catch (docError: any) {
        console.error('[DevProgress] Failed to send as doc:', docError.message);
        return false;
      }
    }
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
    
    // Build the message with markdown formatting
    let message = `📊 Development Progress Update\n${date}\n\n`;
    
    // Add executive summary
    if (update.summary) {
      message += `**Executive Summary**\n${update.summary}\n\n`;
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
    
    // Also save as "last-report.json" for easy access
    const lastReportPath = path.join(this.reportsDir, 'last-report.json');
    await fs.writeFile(lastReportPath, JSON.stringify(report, null, 2));
    
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

  // Send comprehensive update
  async sendProgressUpdate(update: ProgressUpdate): Promise<boolean> {
    const errors = this.validateUpdate(update);
    if (errors.length > 0) {
      console.error('[DevProgress] Validation errors:', errors);
      return false;
    }
    
    const message = this.formatUpdate(update);
    
    // Save report
    const filepath = await this.saveReport(update, message);
    console.log(`[DevProgress] Report saved to ${filepath}`);
    
    // Send to Dart
    const sent = await this.sendUpdate(message);
    
    if (sent) {
      // Update the saved report to mark as sent
      const report = JSON.parse(await fs.readFile(filepath, 'utf-8'));
      report.sent = true;
      report.sentAt = new Date().toISOString();
      await fs.writeFile(filepath, JSON.stringify(report, null, 2));
    }
    
    return sent;
  }
}

// Export singleton instance
export const devProgressService = DevProgressService.getInstance();