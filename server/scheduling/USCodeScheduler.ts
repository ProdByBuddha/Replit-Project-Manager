/**
 * US Code Re-indexing Scheduler
 * 
 * Provides automated daily re-indexing of US Code data with:
 * - Scheduled execution using node-cron
 * - Incremental updates with change detection
 * - Admin controls and monitoring
 * - Robust error handling and recovery
 * - Integration with system settings
 */

import * as cron from 'node-cron';
import { storage } from '../storage';
import { log } from '../vite';
import { spawn } from 'child_process';
import { eventBus } from '../automation/EventBus';
import { errorHandler, apiErrorHandler, timeoutErrorHandler } from './ErrorHandler';

export interface SchedulerConfig {
  enabled: boolean;
  schedule: string; // Cron expression
  incrementalEnabled: boolean;
  priorityTitles: number[]; // Title numbers to prioritize
  maxRetries: number;
  timeoutMinutes: number;
  notifyOnFailure: boolean;
}

export interface SchedulerHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastRun: Date | null;
  nextRun: Date | null;
  isRunning: boolean;
  currentJobId: string | null;
  consecutiveFailures: number;
  lastError: string | null;
  totalRuns: number;
  successfulRuns: number;
}

export interface ScheduledJobStatus {
  jobId: string;
  type: 'scheduled_full' | 'scheduled_incremental' | 'manual_full' | 'manual_incremental';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: Date;
  completedAt?: Date;
  progress: {
    stage: string;
    percentage: number;
    currentTitle?: number;
    titlesProcessed: number;
    totalTitles: number;
    sectionsProcessed: number;
    errors: number;
  };
  stats: {
    apiCalls: number;
    failedApiCalls: number;
    titlesUpdated: number;
    sectionsUpdated: number;
    duration: number;
  };
  errorMessage?: string;
}

class USCodeScheduler {
  private task: cron.ScheduledTask | null = null;
  private config: SchedulerConfig;
  private health: SchedulerHealth;
  private currentJobId: string | null = null;
  private isInitialized = false;

  constructor() {
    this.config = {
      enabled: true, // Default to enabled - aligns with system settings
      schedule: '0 2 * * *', // 2 AM daily
      incrementalEnabled: true,
      priorityTitles: [15, 18, 26], // Commerce, Employment, Internal Revenue Code
      maxRetries: 3,
      timeoutMinutes: 180, // 3 hours
      notifyOnFailure: true,
    };

    this.health = {
      status: 'healthy',
      lastRun: null,
      nextRun: null,
      isRunning: false,
      currentJobId: null,
      consecutiveFailures: 0,
      lastError: null,
      totalRuns: 0,
      successfulRuns: 0,
    };
  }

  /**
   * Initialize the scheduler with configuration from system settings
   */
  async initialize(): Promise<void> {
    try {
      log('[USCodeScheduler] Initializing US Code re-indexing scheduler...');
      
      // Load configuration from system settings
      await this.loadConfiguration();
      
      // Start the scheduler if enabled
      if (this.config.enabled) {
        await this.startScheduler();
      }
      
      this.isInitialized = true;
      log('[USCodeScheduler] Scheduler initialized successfully');
    } catch (error) {
      log(`[USCodeScheduler] Failed to initialize scheduler: ${error}`);
      this.health.status = 'unhealthy';
      this.health.lastError = error instanceof Error ? error.message : String(error);
    }
  }

  /**
   * Load scheduler configuration from system settings
   */
  private async loadConfiguration(): Promise<void> {
    try {
      const settings = await Promise.all([
        storage.getSystemSetting('uscode_scheduler_enabled'),
        storage.getSystemSetting('uscode_scheduler_schedule'),
        storage.getSystemSetting('uscode_scheduler_incremental_enabled'),
        storage.getSystemSetting('uscode_scheduler_priority_titles'),
        storage.getSystemSetting('uscode_scheduler_max_retries'),
        storage.getSystemSetting('uscode_scheduler_timeout_minutes'),
        storage.getSystemSetting('uscode_scheduler_notify_on_failure'),
      ]);

      // Apply settings with fallback to defaults
      if (settings[0]) this.config.enabled = settings[0].value as boolean;
      if (settings[1]) this.config.schedule = settings[1].value as string;
      if (settings[2]) this.config.incrementalEnabled = settings[2].value as boolean;
      if (settings[3]) this.config.priorityTitles = settings[3].value as number[];
      if (settings[4]) this.config.maxRetries = settings[4].value as number;
      if (settings[5]) this.config.timeoutMinutes = settings[5].value as number;
      if (settings[6]) this.config.notifyOnFailure = settings[6].value as boolean;

      log(`[USCodeScheduler] Configuration loaded: ${JSON.stringify(this.config)}`);
    } catch (error) {
      log(`[USCodeScheduler] Warning: Could not load configuration, using defaults: ${error}`);
    }
  }

  /**
   * Start the cron scheduler
   */
  private async startScheduler(): Promise<void> {
    if (this.task) {
      this.task.stop();
    }

    // Validate cron expression
    if (!cron.validate(this.config.schedule)) {
      throw new Error(`Invalid cron schedule: ${this.config.schedule}`);
    }

    this.task = cron.schedule(this.config.schedule, async () => {
      await this.executeScheduledIndexing();
    }, {
      scheduled: false, // Don't start immediately, we'll start it manually
      timezone: 'UTC'
    });

    this.task.start();
    
    // Calculate next run time
    this.updateNextRunTime();
    
    log(`[USCodeScheduler] Scheduler started with schedule: ${this.config.schedule}`);
  }

  /**
   * Stop the scheduler
   */
  stopScheduler(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
      this.health.nextRun = null;
      log('[USCodeScheduler] Scheduler stopped');
    }
  }

  /**
   * Execute scheduled indexing based on configuration
   */
  private async executeScheduledIndexing(): Promise<void> {
    if (this.health.isRunning) {
      log('[USCodeScheduler] Skipping scheduled run - another job is already running');
      return;
    }

    try {
      this.health.isRunning = true;
      this.health.totalRuns++;
      this.health.lastRun = new Date();
      
      let jobType: 'scheduled_full' | 'scheduled_incremental';
      
      if (this.config.incrementalEnabled) {
        // Check if we should do incremental or full indexing
        const shouldDoFull = await this.shouldDoFullIndexing();
        jobType = shouldDoFull ? 'scheduled_full' : 'scheduled_incremental';
      } else {
        jobType = 'scheduled_full';
      }

      log(`[USCodeScheduler] Starting ${jobType} indexing job`);
      
      const jobId = await this.startIndexingJob(jobType);
      this.currentJobId = jobId;
      this.health.currentJobId = jobId;

      // Monitor the job
      await this.monitorJob(jobId);
      
      this.health.successfulRuns++;
      this.health.consecutiveFailures = 0;
      this.health.status = 'healthy';
      this.health.lastError = null;
      
      log(`[USCodeScheduler] Scheduled indexing completed successfully: ${jobId}`);
      
    } catch (error) {
      this.health.consecutiveFailures++;
      this.health.lastError = error instanceof Error ? error.message : String(error);
      
      if (this.health.consecutiveFailures >= 3) {
        this.health.status = 'unhealthy';
      } else {
        this.health.status = 'degraded';
      }
      
      log(`[USCodeScheduler] Scheduled indexing failed: ${error}`);
      
      // Send notification if enabled
      if (this.config.notifyOnFailure) {
        await this.notifyFailure(error);
      }
      
    } finally {
      this.health.isRunning = false;
      this.currentJobId = null;
      this.health.currentJobId = null;
      this.updateNextRunTime();
    }
  }

  /**
   * Determine if we should do full indexing instead of incremental
   */
  private async shouldDoFullIndexing(): Promise<boolean> {
    try {
      // Do full indexing if:
      // 1. It's been more than 7 days since last full indexing
      // 2. There have been multiple consecutive failures
      // 3. No indexing has been done yet
      
      const lastFullIndexJob = await storage.getLastIndexingJobByType('full_index');
      
      if (!lastFullIndexJob) {
        return true; // No full indexing done yet
      }
      
      const daysSinceLastFull = (Date.now() - lastFullIndexJob.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastFull >= 7) {
        return true; // More than 7 days since last full index
      }
      
      if (this.health.consecutiveFailures >= 2) {
        return true; // Multiple failures, try full indexing
      }
      
      return false; // Do incremental
    } catch (error) {
      log(`[USCodeScheduler] Error determining indexing type, defaulting to full: ${error}`);
      return true;
    }
  }

  /**
   * Start an indexing job using the Python indexer
   */
  private async startIndexingJob(type: 'scheduled_full' | 'scheduled_incremental' | 'manual_full' | 'manual_incremental'): Promise<string> {
    // Create job record
    const jobData = {
      jobType: type.includes('incremental') ? 'incremental' : 'full_index',
      status: 'pending' as const,
      startedBy: 'system', // System-initiated
      titleNumber: null,
      progress: { stage: 'initializing', percentage: 0 },
      stats: { processed: 0, errors: 0, apiCalls: 0, duration: 0 },
    };

    const job = await storage.createIndexingJob(jobData);
    
    // Start the Python indexer process
    await this.startPythonIndexer(job.id, type.includes('incremental'));
    
    return job.id;
  }

  /**
   * Start the Python indexer process with error handling
   */
  private async startPythonIndexer(jobId: string, incremental: boolean = false): Promise<void> {
    return timeoutErrorHandler.executeWithRetry(async () => {
      return new Promise<void>((resolve, reject) => {
        const args = ['uscode_indexer.py'];
        if (incremental) {
          args.push('--incremental');
        }
        args.push('--job-id', jobId);

        const process = spawn('python3', args, {
          stdio: ['ignore', 'pipe', 'pipe'],
          cwd: process.cwd(),
          env: { ...process.env, PYTHONPATH: '.' }
        });

        process.stdout?.on('data', (data) => {
          log(`[USCodeIndexer] ${data.toString().trim()}`);
        });

        process.stderr?.on('data', (data) => {
          log(`[USCodeIndexer] ERROR: ${data.toString().trim()}`);
        });

        process.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Indexer process exited with code ${code}`));
          }
        });

        process.on('error', (error) => {
          reject(new Error(`Failed to start indexer process: ${error.message}`));
        });

        // Set timeout based on configuration
        const timeoutHandle = setTimeout(() => {
          process.kill('SIGTERM');
          reject(new Error(`Indexing job timeout after ${this.config.timeoutMinutes} minutes`));
        }, this.config.timeoutMinutes * 60 * 1000);

        // Clear timeout if process completes normally
        process.on('close', () => {
          clearTimeout(timeoutHandle);
        });
      });
    }, `startPythonIndexer-${jobId}`, {
      maxRetries: this.config.maxRetries,
      baseDelay: 5000, // 5 second delay for process failures
      maxDelay: 30000
    });
  }

  /**
   * Monitor an indexing job until completion with error handling
   */
  private async monitorJob(jobId: string): Promise<void> {
    return errorHandler.executeWithRetry(async () => {
      const maxWaitTime = this.config.timeoutMinutes * 60 * 1000; // Convert to milliseconds
      const pollInterval = 10000; // 10 seconds
      const startTime = Date.now();
      
      while (Date.now() - startTime < maxWaitTime) {
        // Use API error handler for storage calls
        const job = await apiErrorHandler.executeWithRetry(async () => {
          return storage.getIndexingJob(jobId);
        }, `getIndexingJob-${jobId}`, {
          maxRetries: 2, // Quick retries for DB calls
          baseDelay: 1000
        });
        
        if (!job) {
          throw new Error(`Job ${jobId} not found`);
        }
        
        if (job.status === 'completed') {
          log(`[USCodeScheduler] Job ${jobId} completed successfully`);
          return;
        }
        
        if (job.status === 'failed') {
          throw new Error(`Job ${jobId} failed: ${job.errorMessage || 'Unknown error'}`);
        }
        
        // Log progress
        if (job.progress) {
          log(`[USCodeScheduler] Job ${jobId} progress: ${job.progress.stage} (${job.progress.percentage}%)`);
        }
        
        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
      
      throw new Error(`Job ${jobId} timeout after ${this.config.timeoutMinutes} minutes`);
    }, `monitorJob-${jobId}`, {
      maxRetries: 1, // Don't retry the entire monitoring process
      baseDelay: 0
    });
  }

  /**
   * Update next run time based on cron schedule
   */
  private updateNextRunTime(): void {
    if (this.task && this.config.enabled) {
      // Parse cron schedule to determine next run
      // This is a simplified calculation - for production, consider using a cron parser library
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(2, 0, 0, 0); // Assuming 2 AM daily schedule
      this.health.nextRun = tomorrow;
    }
  }

  /**
   * Send failure notification
   */
  private async notifyFailure(error: any): Promise<void> {
    try {
      // Get admin users for notification
      const adminUsers = await storage.getAdminUsers();
      
      // Create system message about the failure
      for (const admin of adminUsers) {
        await storage.createMessage({
          familyId: admin.familyId || 'system',
          fromUserId: 'system',
          toRole: 'admin',
          subject: 'US Code Indexing Failure',
          content: `Automated US Code re-indexing failed: ${error instanceof Error ? error.message : String(error)}. Please check the system logs and consider running a manual indexing job.`,
          messageType: 'error'
        });
      }
      
      log('[USCodeScheduler] Failure notification sent to administrators');
    } catch (notificationError) {
      log(`[USCodeScheduler] Failed to send failure notification: ${notificationError}`);
    }
  }

  /**
   * Manually trigger indexing job
   */
  async triggerManualIndexing(type: 'full' | 'incremental', userId: string): Promise<string> {
    if (this.health.isRunning) {
      throw new Error('Another indexing job is already running');
    }

    try {
      this.health.isRunning = true;
      
      const jobType = type === 'full' ? 'manual_full' : 'manual_incremental';
      const jobId = await this.startIndexingJob(jobType);
      
      log(`[USCodeScheduler] Manual ${type} indexing started by user ${userId}: ${jobId}`);
      
      // Don't await - let it run in background
      this.monitorJob(jobId)
        .then(() => {
          log(`[USCodeScheduler] Manual indexing completed: ${jobId}`);
        })
        .catch((error) => {
          log(`[USCodeScheduler] Manual indexing failed: ${error}`);
        })
        .finally(() => {
          this.health.isRunning = false;
        });
      
      return jobId;
    } catch (error) {
      this.health.isRunning = false;
      throw error;
    }
  }

  /**
   * Update scheduler configuration with hot-reload support
   */
  async updateConfiguration(newConfig: Partial<SchedulerConfig>): Promise<void> {
    const oldConfig = { ...this.config };
    
    // Update configuration in memory first
    Object.assign(this.config, newConfig);
    
    // Save to system settings with error handling
    const settingsPromises = [];
    if (newConfig.enabled !== undefined) {
      settingsPromises.push(storage.setSystemSetting('uscode_scheduler_enabled', newConfig.enabled));
    }
    if (newConfig.schedule !== undefined) {
      settingsPromises.push(storage.setSystemSetting('uscode_scheduler_schedule', newConfig.schedule));
    }
    if (newConfig.incrementalEnabled !== undefined) {
      settingsPromises.push(storage.setSystemSetting('uscode_scheduler_incremental_enabled', newConfig.incrementalEnabled));
    }
    if (newConfig.priorityTitles !== undefined) {
      settingsPromises.push(storage.setSystemSetting('uscode_scheduler_priority_titles', newConfig.priorityTitles));
    }
    if (newConfig.maxRetries !== undefined) {
      settingsPromises.push(storage.setSystemSetting('uscode_scheduler_max_retries', newConfig.maxRetries));
    }
    if (newConfig.timeoutMinutes !== undefined) {
      settingsPromises.push(storage.setSystemSetting('uscode_scheduler_timeout_minutes', newConfig.timeoutMinutes));
    }
    if (newConfig.notifyOnFailure !== undefined) {
      settingsPromises.push(storage.setSystemSetting('uscode_scheduler_notify_on_failure', newConfig.notifyOnFailure));
    }
    
    // Apply settings with error handling
    await apiErrorHandler.executeWithRetry(async () => {
      await Promise.all(settingsPromises);
    }, 'updateSchedulerConfiguration-saveSettings');
    
    // Always restart scheduler if critical settings changed
    const needsRestart = (
      (newConfig.enabled !== undefined && newConfig.enabled !== oldConfig.enabled) ||
      (newConfig.schedule !== undefined && newConfig.schedule !== oldConfig.schedule)
    );
    
    if (needsRestart) {
      try {
        // Stop current scheduler regardless of state
        this.stopScheduler();
        
        // Start new scheduler if enabled
        if (this.config.enabled) {
          await this.startScheduler();
          log(`[USCodeScheduler] Scheduler restarted with new configuration`);
        } else {
          log(`[USCodeScheduler] Scheduler stopped via configuration update`);
        }
      } catch (error) {
        log(`[USCodeScheduler] Error restarting scheduler: ${error}`);
        // Rollback configuration on restart failure
        Object.assign(this.config, oldConfig);
        throw new Error(`Failed to apply configuration changes: ${error}`);
      }
    }
    
    // Update next run time
    this.updateNextRunTime();
    
    log(`[USCodeScheduler] Configuration updated successfully: ${JSON.stringify(this.config)}`);
  }

  /**
   * Get current scheduler health status
   */
  getHealth(): SchedulerHealth {
    return { ...this.health };
  }

  /**
   * Get current configuration
   */
  getConfiguration(): SchedulerConfig {
    return { ...this.config };
  }

  /**
   * Check if scheduler is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}

// Export singleton instance
export const usCodeScheduler = new USCodeScheduler();

// Export health check function
export function getSchedulerHealth() {
  return usCodeScheduler.getHealth();
}

// Export manual trigger function
export async function triggerManualIndexing(type: 'full' | 'incremental', userId: string) {
  return usCodeScheduler.triggerManualIndexing(type, userId);
}

// Export configuration update function
export async function updateSchedulerConfiguration(config: Partial<SchedulerConfig>) {
  return usCodeScheduler.updateConfiguration(config);
}