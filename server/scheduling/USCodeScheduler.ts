/**
 * Unified Legal Content Scheduler
 * 
 * Provides automated daily re-indexing of both US Code and UCC data with:
 * - Scheduled execution using node-cron for both US Code and UCC
 * - Incremental updates with change detection
 * - Unified and independent scheduling modes
 * - Admin controls and monitoring for both systems
 * - Robust error handling and recovery
 * - Integration with system settings
 * - Concurrent or sequential execution modes
 */

import * as cron from 'node-cron';
import { storage } from '../storage';
import { log } from '../vite';
import { spawn } from 'child_process';
import { eventBus } from '../automation/EventBus';
import { errorHandler, apiErrorHandler, timeoutErrorHandler } from './ErrorHandler';

export interface SchedulerConfig {
  // US Code settings
  enabled: boolean;
  schedule: string; // Cron expression
  incrementalEnabled: boolean;
  priorityTitles: number[]; // Title numbers to prioritize
  maxRetries: number;
  timeoutMinutes: number;
  notifyOnFailure: boolean;
  
  // UCC settings
  uccEnabled: boolean;
  uccSchedule: string; // Cron expression for UCC
  uccIncrementalEnabled: boolean;
  uccPriorityArticles: string[]; // UCC article numbers to prioritize
  uccMaxRetries: number;
  uccTimeoutMinutes: number;
  uccNotifyOnFailure: boolean;
  
  // Unified settings
  concurrentExecution: boolean; // Run US Code and UCC concurrently or sequentially
  resourceThrottling: boolean; // Enable resource throttling between jobs
}

export interface SchedulerHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  // US Code health
  usCode: {
    lastRun: Date | null;
    nextRun: Date | null;
    isRunning: boolean;
    currentJobId: string | null;
    consecutiveFailures: number;
    lastError: string | null;
    totalRuns: number;
    successfulRuns: number;
  };
  // UCC health
  ucc: {
    lastRun: Date | null;
    nextRun: Date | null;
    isRunning: boolean;
    currentJobId: string | null;
    consecutiveFailures: number;
    lastError: string | null;
    totalRuns: number;
    successfulRuns: number;
  };
  // Overall system health
  overallHealth: 'healthy' | 'degraded' | 'unhealthy';
}

export interface ScheduledJobStatus {
  jobId: string;
  type: 'scheduled_full' | 'scheduled_incremental' | 'manual_full' | 'manual_incremental' | 
        'ucc_scheduled_full' | 'ucc_scheduled_incremental' | 'ucc_manual_full' | 'ucc_manual_incremental' |
        'ucc_article_update';
  contentType: 'uscode' | 'ucc';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: Date;
  completedAt?: Date;
  progress: {
    stage: string;
    percentage: number;
    // US Code specific
    currentTitle?: number;
    titlesProcessed: number;
    totalTitles: number;
    sectionsProcessed: number;
    // UCC specific
    currentArticle?: string;
    articlesProcessed: number;
    totalArticles: number;
    partsProcessed: number;
    definitionsExtracted: number;
    crossReferencesFound: number;
    errors: number;
  };
  stats: {
    apiCalls: number;
    failedApiCalls: number;
    // US Code stats
    titlesUpdated: number;
    sectionsUpdated: number;
    // UCC stats
    articlesUpdated: number;
    uccSectionsUpdated: number;
    uccPartsUpdated: number;
    duration: number;
  };
  errorMessage?: string;
}

class UnifiedLegalScheduler {
  private usCodeTask: cron.ScheduledTask | null = null;
  private uccTask: cron.ScheduledTask | null = null;
  private config: SchedulerConfig;
  private health: SchedulerHealth;
  private currentUsCodeJobId: string | null = null;
  private currentUccJobId: string | null = null;
  private isInitialized = false;

  constructor() {
    this.config = {
      // US Code defaults
      enabled: true,
      schedule: '0 2 * * *', // 2 AM daily
      incrementalEnabled: true,
      priorityTitles: [15, 18, 26], // Commerce, Employment, Internal Revenue Code
      maxRetries: 3,
      timeoutMinutes: 180, // 3 hours
      notifyOnFailure: true,
      
      // UCC defaults
      uccEnabled: true,
      uccSchedule: '30 2 * * *', // 2:30 AM daily (30 min after US Code)
      uccIncrementalEnabled: true,
      uccPriorityArticles: ['1', '2', '9'], // General Provisions, Sales, Secured Transactions
      uccMaxRetries: 3,
      uccTimeoutMinutes: 120, // 2 hours (UCC is smaller dataset)
      uccNotifyOnFailure: true,
      
      // Unified defaults
      concurrentExecution: false, // Sequential by default to avoid resource conflicts
      resourceThrottling: true,
    };

    this.health = {
      status: 'healthy',
      usCode: {
        lastRun: null,
        nextRun: null,
        isRunning: false,
        currentJobId: null,
        consecutiveFailures: 0,
        lastError: null,
        totalRuns: 0,
        successfulRuns: 0,
      },
      ucc: {
        lastRun: null,
        nextRun: null,
        isRunning: false,
        currentJobId: null,
        consecutiveFailures: 0,
        lastError: null,
        totalRuns: 0,
        successfulRuns: 0,
      },
      overallHealth: 'healthy',
    };
  }

  /**
   * Initialize the scheduler with configuration from system settings
   */
  async initialize(): Promise<void> {
    try {
      log('[UnifiedLegalScheduler] Initializing unified legal content scheduler...');
      
      // Load configuration from system settings
      await this.loadConfiguration();
      
      // Start US Code scheduler if enabled
      if (this.config.enabled) {
        await this.startUsCodeScheduler();
      }
      
      // Start UCC scheduler if enabled
      if (this.config.uccEnabled) {
        await this.startUccScheduler();
      }
      
      this.isInitialized = true;
      log('[UnifiedLegalScheduler] Scheduler initialized successfully');
    } catch (error) {
      log(`[UnifiedLegalScheduler] Failed to initialize scheduler: ${error}`);
      this.health.status = 'unhealthy';
      this.health.usCode.lastError = error instanceof Error ? error.message : String(error);
      this.health.ucc.lastError = error instanceof Error ? error.message : String(error);
      this.updateOverallHealth();
    }
  }

  /**
   * Load scheduler configuration from system settings
   */
  private async loadConfiguration(): Promise<void> {
    try {
      const settings = await Promise.all([
        // US Code settings
        storage.getSystemSetting('uscode_scheduler_enabled'),
        storage.getSystemSetting('uscode_scheduler_schedule'),
        storage.getSystemSetting('uscode_scheduler_incremental_enabled'),
        storage.getSystemSetting('uscode_scheduler_priority_titles'),
        storage.getSystemSetting('uscode_scheduler_max_retries'),
        storage.getSystemSetting('uscode_scheduler_timeout_minutes'),
        storage.getSystemSetting('uscode_scheduler_notify_on_failure'),
        // UCC settings
        storage.getSystemSetting('ucc_scheduler_enabled'),
        storage.getSystemSetting('ucc_scheduler_schedule'),
        storage.getSystemSetting('ucc_scheduler_incremental_enabled'),
        storage.getSystemSetting('ucc_scheduler_priority_articles'),
        storage.getSystemSetting('ucc_scheduler_max_retries'),
        storage.getSystemSetting('ucc_scheduler_timeout_minutes'),
        storage.getSystemSetting('ucc_scheduler_notify_on_failure'),
        // Unified settings
        storage.getSystemSetting('legal_scheduler_concurrent_execution'),
        storage.getSystemSetting('legal_scheduler_resource_throttling'),
      ]);

      // Apply US Code settings with fallback to defaults
      if (settings[0]) this.config.enabled = settings[0].value as boolean;
      if (settings[1]) this.config.schedule = settings[1].value as string;
      if (settings[2]) this.config.incrementalEnabled = settings[2].value as boolean;
      if (settings[3]) this.config.priorityTitles = settings[3].value as number[];
      if (settings[4]) this.config.maxRetries = settings[4].value as number;
      if (settings[5]) this.config.timeoutMinutes = settings[5].value as number;
      if (settings[6]) this.config.notifyOnFailure = settings[6].value as boolean;
      
      // Apply UCC settings with fallback to defaults
      if (settings[7]) this.config.uccEnabled = settings[7].value as boolean;
      if (settings[8]) this.config.uccSchedule = settings[8].value as string;
      if (settings[9]) this.config.uccIncrementalEnabled = settings[9].value as boolean;
      if (settings[10]) this.config.uccPriorityArticles = settings[10].value as string[];
      if (settings[11]) this.config.uccMaxRetries = settings[11].value as number;
      if (settings[12]) this.config.uccTimeoutMinutes = settings[12].value as number;
      if (settings[13]) this.config.uccNotifyOnFailure = settings[13].value as boolean;
      
      // Apply unified settings
      if (settings[14]) this.config.concurrentExecution = settings[14].value as boolean;
      if (settings[15]) this.config.resourceThrottling = settings[15].value as boolean;

      log(`[UnifiedLegalScheduler] Configuration loaded: ${JSON.stringify(this.config)}`);
    } catch (error) {
      log(`[UnifiedLegalScheduler] Warning: Could not load configuration, using defaults: ${error}`);
    }
  }

  /**
   * Start the US Code cron scheduler
   */
  private async startUsCodeScheduler(): Promise<void> {
    if (this.usCodeTask) {
      this.usCodeTask.stop();
    }

    // Validate cron expression
    if (!cron.validate(this.config.schedule)) {
      throw new Error(`Invalid US Code cron schedule: ${this.config.schedule}`);
    }

    this.usCodeTask = cron.schedule(this.config.schedule, async () => {
      await this.executeScheduledUsCodeIndexing();
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    this.usCodeTask.start();
    
    // Calculate next run time
    this.updateUsCodeNextRunTime();
    
    log(`[UnifiedLegalScheduler] US Code scheduler started with schedule: ${this.config.schedule}`);
  }

  /**
   * Start the UCC cron scheduler
   */
  private async startUccScheduler(): Promise<void> {
    if (this.uccTask) {
      this.uccTask.stop();
    }

    // Validate cron expression
    if (!cron.validate(this.config.uccSchedule)) {
      throw new Error(`Invalid UCC cron schedule: ${this.config.uccSchedule}`);
    }

    this.uccTask = cron.schedule(this.config.uccSchedule, async () => {
      await this.executeScheduledUccIndexing();
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    this.uccTask.start();
    
    // Calculate next run time
    this.updateUccNextRunTime();
    
    log(`[UnifiedLegalScheduler] UCC scheduler started with schedule: ${this.config.uccSchedule}`);
  }

  /**
   * Stop all schedulers
   */
  stopSchedulers(): void {
    if (this.usCodeTask) {
      this.usCodeTask.stop();
      this.usCodeTask = null;
      this.health.usCode.nextRun = null;
      log('[UnifiedLegalScheduler] US Code scheduler stopped');
    }
    
    if (this.uccTask) {
      this.uccTask.stop();
      this.uccTask = null;
      this.health.ucc.nextRun = null;
      log('[UnifiedLegalScheduler] UCC scheduler stopped');
    }
  }

  /**
   * Stop US Code scheduler only
   */
  stopUsCodeScheduler(): void {
    if (this.usCodeTask) {
      this.usCodeTask.stop();
      this.usCodeTask = null;
      this.health.usCode.nextRun = null;
      log('[UnifiedLegalScheduler] US Code scheduler stopped');
    }
  }

  /**
   * Stop UCC scheduler only
   */
  stopUccScheduler(): void {
    if (this.uccTask) {
      this.uccTask.stop();
      this.uccTask = null;
      this.health.ucc.nextRun = null;
      log('[UnifiedLegalScheduler] UCC scheduler stopped');
    }
  }

  /**
   * Execute scheduled US Code indexing
   */
  private async executeScheduledUsCodeIndexing(): Promise<void> {
    if (this.health.usCode.isRunning) {
      log('[UnifiedLegalScheduler] Skipping US Code scheduled run - another job is already running');
      return;
    }

    try {
      this.health.usCode.isRunning = true;
      this.health.usCode.totalRuns++;
      this.health.usCode.lastRun = new Date();
      
      let jobType: 'scheduled_full' | 'scheduled_incremental';
      
      if (this.config.incrementalEnabled) {
        const shouldDoFull = await this.shouldDoFullUsCodeIndexing();
        jobType = shouldDoFull ? 'scheduled_full' : 'scheduled_incremental';
      } else {
        jobType = 'scheduled_full';
      }

      log(`[UnifiedLegalScheduler] Starting US Code ${jobType} indexing job`);
      
      const jobId = await this.startUsCodeIndexingJob(jobType);
      this.currentUsCodeJobId = jobId;
      this.health.usCode.currentJobId = jobId;

      await this.monitorUsCodeJob(jobId);
      
      this.health.usCode.successfulRuns++;
      this.health.usCode.consecutiveFailures = 0;
      this.health.usCode.lastError = null;
      
      log(`[UnifiedLegalScheduler] US Code scheduled indexing completed successfully: ${jobId}`);
      
    } catch (error) {
      this.health.usCode.consecutiveFailures++;
      this.health.usCode.lastError = error instanceof Error ? error.message : String(error);
      
      log(`[UnifiedLegalScheduler] US Code scheduled indexing failed: ${error}`);
      
      if (this.config.notifyOnFailure) {
        await this.notifyUsCodeFailure(error);
      }
      
    } finally {
      this.health.usCode.isRunning = false;
      this.currentUsCodeJobId = null;
      this.health.usCode.currentJobId = null;
      this.updateUsCodeNextRunTime();
      this.updateOverallHealth();
    }
  }

  /**
   * Execute scheduled UCC indexing
   */
  private async executeScheduledUccIndexing(): Promise<void> {
    // Check if concurrent execution is disabled and US Code is running
    if (!this.config.concurrentExecution && this.health.usCode.isRunning) {
      log('[UnifiedLegalScheduler] Waiting for US Code indexing to complete before starting UCC indexing');
      // Wait for US Code to finish, then start UCC
      await this.waitForUsCodeCompletion();
    }
    
    if (this.health.ucc.isRunning) {
      log('[UnifiedLegalScheduler] Skipping UCC scheduled run - another job is already running');
      return;
    }

    try {
      this.health.ucc.isRunning = true;
      this.health.ucc.totalRuns++;
      this.health.ucc.lastRun = new Date();
      
      let jobType: 'ucc_scheduled_full' | 'ucc_scheduled_incremental';
      
      if (this.config.uccIncrementalEnabled) {
        const shouldDoFull = await this.shouldDoFullUccIndexing();
        jobType = shouldDoFull ? 'ucc_scheduled_full' : 'ucc_scheduled_incremental';
      } else {
        jobType = 'ucc_scheduled_full';
      }

      log(`[UnifiedLegalScheduler] Starting UCC ${jobType} indexing job`);
      
      const jobId = await this.startUccIndexingJob(jobType);
      this.currentUccJobId = jobId;
      this.health.ucc.currentJobId = jobId;

      await this.monitorUccJob(jobId);
      
      this.health.ucc.successfulRuns++;
      this.health.ucc.consecutiveFailures = 0;
      this.health.ucc.lastError = null;
      
      log(`[UnifiedLegalScheduler] UCC scheduled indexing completed successfully: ${jobId}`);
      
    } catch (error) {
      this.health.ucc.consecutiveFailures++;
      this.health.ucc.lastError = error instanceof Error ? error.message : String(error);
      
      log(`[UnifiedLegalScheduler] UCC scheduled indexing failed: ${error}`);
      
      if (this.config.uccNotifyOnFailure) {
        await this.notifyUccFailure(error);
      }
      
    } finally {
      this.health.ucc.isRunning = false;
      this.currentUccJobId = null;
      this.health.ucc.currentJobId = null;
      this.updateUccNextRunTime();
      this.updateOverallHealth();
    }
  }

  /**
   * Determine if we should do full US Code indexing instead of incremental
   */
  private async shouldDoFullUsCodeIndexing(): Promise<boolean> {
    try {
      const lastFullIndexJob = await storage.getLastIndexingJobByType('full_index');
      
      if (!lastFullIndexJob) {
        return true;
      }
      
      const daysSinceLastFull = (Date.now() - lastFullIndexJob.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastFull >= 7) {
        return true;
      }
      
      if (this.health.usCode.consecutiveFailures >= 2) {
        return true;
      }
      
      return false;
    } catch (error) {
      log(`[UnifiedLegalScheduler] Error determining US Code indexing type, defaulting to full: ${error}`);
      return true;
    }
  }

  /**
   * Determine if we should do full UCC indexing instead of incremental
   */
  private async shouldDoFullUccIndexing(): Promise<boolean> {
    try {
      const lastFullUccJob = await storage.getLastIndexingJobByType('ucc_full_index');
      
      if (!lastFullUccJob) {
        return true; // No full UCC indexing done yet
      }
      
      const daysSinceLastFull = (Date.now() - lastFullUccJob.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastFull >= 7) {
        return true; // More than 7 days since last full UCC index
      }
      
      if (this.health.ucc.consecutiveFailures >= 2) {
        return true; // Multiple failures, try full indexing
      }
      
      return false; // Do incremental
    } catch (error) {
      log(`[UnifiedLegalScheduler] Error determining UCC indexing type, defaulting to full: ${error}`);
      return true;
    }
  }

  /**
   * Start a US Code indexing job using the Python indexer
   */
  private async startUsCodeIndexingJob(type: 'scheduled_full' | 'scheduled_incremental' | 'manual_full' | 'manual_incremental'): Promise<string> {
    // Create job record
    const jobData = {
      jobType: type.includes('incremental') ? 'incremental' : 'full_index',
      contentType: 'uscode' as const,
      status: 'pending' as const,
      startedBy: 'system',
      titleNumber: null,
      progress: { stage: 'initializing', percentage: 0 },
      stats: { processed: 0, errors: 0, apiCalls: 0, duration: 0 },
    };

    const job = await storage.createIndexingJob(jobData);
    
    // Start the US Code Python indexer process
    await this.startPythonUsCodeIndexer(job.id, type.includes('incremental'));
    
    return job.id;
  }

  /**
   * Start a UCC indexing job using the Python UCC indexer
   */
  private async startUccIndexingJob(type: 'ucc_scheduled_full' | 'ucc_scheduled_incremental' | 'ucc_manual_full' | 'ucc_manual_incremental' | 'ucc_article_update'): Promise<string> {
    // Create UCC job record
    const jobData = {
      jobType: type.includes('incremental') ? 'ucc_incremental' : 'ucc_full_index',
      contentType: 'ucc' as const,
      status: 'pending' as const,
      startedBy: 'system',
      articleNumber: type === 'ucc_article_update' ? this.config.uccPriorityArticles[0] : null,
      progress: { stage: 'initializing', percentage: 0 },
      stats: { processed: 0, errors: 0, apiCalls: 0, duration: 0 },
    };

    const job = await storage.createIndexingJob(jobData);
    
    // Start the UCC Python indexer process
    await this.startPythonUccIndexer(job.id, type.includes('incremental'), 
                                     type === 'ucc_article_update' ? this.config.uccPriorityArticles[0] : null);
    
    return job.id;
  }

  /**
   * Start the US Code Python indexer process with error handling
   */
  private async startPythonUsCodeIndexer(jobId: string, incremental: boolean = false): Promise<void> {
    return timeoutErrorHandler.executeWithRetry(async () => {
      return new Promise<void>((resolve, reject) => {
        const args = ['uscode_indexer.py'];
        if (incremental) {
          args.push('--incremental');
        }
        args.push('--job-id', jobId);

        const childProcess = spawn('python3', args, {
          stdio: ['ignore', 'pipe', 'pipe'],
          cwd: process.cwd(),
          env: { ...process.env, PYTHONPATH: '.' }
        });

        childProcess.stdout?.on('data', (data) => {
          log(`[USCodeIndexer] ${data.toString().trim()}`);
        });

        childProcess.stderr?.on('data', (data) => {
          log(`[USCodeIndexer] ERROR: ${data.toString().trim()}`);
        });

        childProcess.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`US Code indexer process exited with code ${code}`));
          }
        });

        childProcess.on('error', (error) => {
          reject(new Error(`Failed to start US Code indexer process: ${error.message}`));
        });

        // Set timeout based on configuration
        const timeoutHandle = setTimeout(() => {
          childProcess.kill('SIGTERM');
          reject(new Error(`US Code indexing job timeout after ${this.config.timeoutMinutes} minutes`));
        }, this.config.timeoutMinutes * 60 * 1000);

        childProcess.on('close', () => {
          clearTimeout(timeoutHandle);
        });
      });
    }, `startPythonUsCodeIndexer-${jobId}`, {
      maxRetries: this.config.maxRetries,
      baseDelay: 5000,
      maxDelay: 30000
    });
  }

  /**
   * Start the UCC Python indexer process with error handling
   */
  private async startPythonUccIndexer(jobId: string, incremental: boolean = false, articleNumber: string | null = null): Promise<void> {
    return timeoutErrorHandler.executeWithRetry(async () => {
      return new Promise<void>((resolve, reject) => {
        const args = ['ucc_indexer.py'];
        if (incremental) {
          args.push('--incremental');
        }
        if (articleNumber) {
          args.push('--article', articleNumber);
        }
        args.push('--job-id', jobId);

        const childProcess = spawn('python3', args, {
          stdio: ['ignore', 'pipe', 'pipe'],
          cwd: process.cwd(),
          env: { 
            ...process.env, 
            PYTHONPATH: '.',
            PARLANT_SHARED_SECRET: process.env.PARLANT_SHARED_SECRET
          }
        });

        childProcess.stdout?.on('data', (data) => {
          log(`[UCCIndexer] ${data.toString().trim()}`);
        });

        childProcess.stderr?.on('data', (data) => {
          log(`[UCCIndexer] ERROR: ${data.toString().trim()}`);
        });

        childProcess.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`UCC indexer process exited with code ${code}`));
          }
        });

        childProcess.on('error', (error) => {
          reject(new Error(`Failed to start UCC indexer process: ${error.message}`));
        });

        // Set timeout based on UCC configuration
        const timeoutHandle = setTimeout(() => {
          childProcess.kill('SIGTERM');
          reject(new Error(`UCC indexing job timeout after ${this.config.uccTimeoutMinutes} minutes`));
        }, this.config.uccTimeoutMinutes * 60 * 1000);

        childProcess.on('close', () => {
          clearTimeout(timeoutHandle);
        });
      });
    }, `startPythonUccIndexer-${jobId}`, {
      maxRetries: this.config.uccMaxRetries,
      baseDelay: 5000,
      maxDelay: 30000
    });
  }

  /**
   * Monitor a US Code indexing job until completion
   */
  private async monitorUsCodeJob(jobId: string): Promise<void> {
    return errorHandler.executeWithRetry(async () => {
      const maxWaitTime = this.config.timeoutMinutes * 60 * 1000;
      const pollInterval = 10000;
      const startTime = Date.now();
      
      while (Date.now() - startTime < maxWaitTime) {
        const job = await apiErrorHandler.executeWithRetry(async () => {
          return storage.getIndexingJob(jobId);
        }, `getUsCodeIndexingJob-${jobId}`, {
          maxRetries: 2,
          baseDelay: 1000
        });
        
        if (!job) {
          throw new Error(`US Code job ${jobId} not found`);
        }
        
        if (job.status === 'completed') {
          log(`[UnifiedLegalScheduler] US Code job ${jobId} completed successfully`);
          return;
        }
        
        if (job.status === 'failed') {
          throw new Error(`US Code job ${jobId} failed: ${job.errorMessage || 'Unknown error'}`);
        }
        
        if (job.progress) {
          log(`[UnifiedLegalScheduler] US Code job ${jobId} progress: ${job.progress.stage} (${job.progress.percentage}%)`);
        }
        
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
      
      throw new Error(`US Code job ${jobId} timeout after ${this.config.timeoutMinutes} minutes`);
    }, `monitorUsCodeJob-${jobId}`, {
      maxRetries: 1,
      baseDelay: 0
    });
  }

  /**
   * Monitor a UCC indexing job until completion
   */
  private async monitorUccJob(jobId: string): Promise<void> {
    return errorHandler.executeWithRetry(async () => {
      const maxWaitTime = this.config.uccTimeoutMinutes * 60 * 1000;
      const pollInterval = 10000;
      const startTime = Date.now();
      
      while (Date.now() - startTime < maxWaitTime) {
        const job = await apiErrorHandler.executeWithRetry(async () => {
          return storage.getIndexingJob(jobId);
        }, `getUccIndexingJob-${jobId}`, {
          maxRetries: 2,
          baseDelay: 1000
        });
        
        if (!job) {
          throw new Error(`UCC job ${jobId} not found`);
        }
        
        if (job.status === 'completed') {
          log(`[UnifiedLegalScheduler] UCC job ${jobId} completed successfully`);
          return;
        }
        
        if (job.status === 'failed') {
          throw new Error(`UCC job ${jobId} failed: ${job.errorMessage || 'Unknown error'}`);
        }
        
        if (job.progress) {
          log(`[UnifiedLegalScheduler] UCC job ${jobId} progress: ${job.progress.stage} (${job.progress.percentage}%)`);
        }
        
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
      
      throw new Error(`UCC job ${jobId} timeout after ${this.config.uccTimeoutMinutes} minutes`);
    }, `monitorUccJob-${jobId}`, {
      maxRetries: 1,
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
   * Update US Code next run time based on cron schedule
   */
  private updateUsCodeNextRunTime(): void {
    if (this.usCodeTask && this.config.enabled) {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(2, 0, 0, 0); // Assuming 2 AM daily schedule
      this.health.usCode.nextRun = tomorrow;
    }
  }

  /**
   * Update UCC next run time based on cron schedule
   */
  private updateUccNextRunTime(): void {
    if (this.uccTask && this.config.uccEnabled) {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(2, 30, 0, 0); // Assuming 2:30 AM daily schedule
      this.health.ucc.nextRun = tomorrow;
    }
  }

  /**
   * Update overall health status based on individual component health
   */
  private updateOverallHealth(): void {
    const usCodeHealthy = this.health.usCode.consecutiveFailures < 3;
    const uccHealthy = this.health.ucc.consecutiveFailures < 3;
    
    if (usCodeHealthy && uccHealthy) {
      this.health.overallHealth = 'healthy';
    } else if (usCodeHealthy || uccHealthy) {
      this.health.overallHealth = 'degraded';
    } else {
      this.health.overallHealth = 'unhealthy';
    }
    
    // Update legacy status for backward compatibility
    this.health.status = this.health.overallHealth;
  }

  /**
   * Wait for US Code completion (for sequential execution)
   */
  private async waitForUsCodeCompletion(): Promise<void> {
    const maxWaitTime = this.config.timeoutMinutes * 60 * 1000 + 300000; // Extra 5 minutes
    const pollInterval = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (this.health.usCode.isRunning && (Date.now() - startTime < maxWaitTime)) {
      log('[UnifiedLegalScheduler] Waiting for US Code indexing to complete...');
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    if (this.health.usCode.isRunning) {
      log('[UnifiedLegalScheduler] Warning: US Code indexing still running, proceeding with UCC indexing');
    }
  }

  /**
   * Send US Code failure notification
   */
  private async notifyUsCodeFailure(error: any): Promise<void> {
    try {
      const adminUsers = await storage.getAdminUsers();
      
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
      
      log('[UnifiedLegalScheduler] US Code failure notification sent to administrators');
    } catch (notificationError) {
      log(`[UnifiedLegalScheduler] Failed to send US Code failure notification: ${notificationError}`);
    }
  }

  /**
   * Send UCC failure notification
   */
  private async notifyUccFailure(error: any): Promise<void> {
    try {
      const adminUsers = await storage.getAdminUsers();
      
      for (const admin of adminUsers) {
        await storage.createMessage({
          familyId: admin.familyId || 'system',
          fromUserId: 'system',
          toRole: 'admin',
          subject: 'UCC Indexing Failure',
          content: `Automated UCC re-indexing failed: ${error instanceof Error ? error.message : String(error)}. Please check the system logs and consider running a manual UCC indexing job.`,
          messageType: 'error'
        });
      }
      
      log('[UnifiedLegalScheduler] UCC failure notification sent to administrators');
    } catch (notificationError) {
      log(`[UnifiedLegalScheduler] Failed to send UCC failure notification: ${notificationError}`);
    }
  }

  /**
   * Manually trigger US Code indexing job
   */
  async triggerManualUsCodeIndexing(type: 'full' | 'incremental', userId: string): Promise<string> {
    if (this.health.usCode.isRunning) {
      throw new Error('Another US Code indexing job is already running');
    }

    try {
      this.health.usCode.isRunning = true;
      
      const jobType = type === 'full' ? 'manual_full' : 'manual_incremental';
      const jobId = await this.startUsCodeIndexingJob(jobType);
      
      log(`[UnifiedLegalScheduler] Manual US Code ${type} indexing started by user ${userId}: ${jobId}`);
      
      // Run in background
      this.monitorUsCodeJob(jobId)
        .then(() => {
          log(`[UnifiedLegalScheduler] Manual US Code indexing completed: ${jobId}`);
          this.health.usCode.successfulRuns++;
          this.health.usCode.consecutiveFailures = 0;
        })
        .catch((error) => {
          log(`[UnifiedLegalScheduler] Manual US Code indexing failed: ${error}`);
          this.health.usCode.consecutiveFailures++;
        })
        .finally(() => {
          this.health.usCode.isRunning = false;
          this.updateOverallHealth();
        });
      
      return jobId;
    } catch (error) {
      this.health.usCode.isRunning = false;
      throw error;
    }
  }

  /**
   * Manually trigger UCC indexing job
   */
  async triggerManualUccIndexing(type: 'full' | 'incremental' | 'article', userId: string, articleNumber?: string): Promise<string> {
    if (this.health.ucc.isRunning) {
      throw new Error('Another UCC indexing job is already running');
    }

    try {
      this.health.ucc.isRunning = true;
      
      let jobType: 'ucc_manual_full' | 'ucc_manual_incremental' | 'ucc_article_update';
      if (type === 'article') {
        jobType = 'ucc_article_update';
      } else {
        jobType = type === 'full' ? 'ucc_manual_full' : 'ucc_manual_incremental';
      }
      
      const jobId = await this.startUccIndexingJob(jobType);
      
      log(`[UnifiedLegalScheduler] Manual UCC ${type} indexing started by user ${userId}: ${jobId}`);
      
      // Run in background
      this.monitorUccJob(jobId)
        .then(() => {
          log(`[UnifiedLegalScheduler] Manual UCC indexing completed: ${jobId}`);
          this.health.ucc.successfulRuns++;
          this.health.ucc.consecutiveFailures = 0;
        })
        .catch((error) => {
          log(`[UnifiedLegalScheduler] Manual UCC indexing failed: ${error}`);
          this.health.ucc.consecutiveFailures++;
        })
        .finally(() => {
          this.health.ucc.isRunning = false;
          this.updateOverallHealth();
        });
      
      return jobId;
    } catch (error) {
      this.health.ucc.isRunning = false;
      throw error;
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  async triggerManualIndexing(type: 'full' | 'incremental', userId: string): Promise<string> {
    return this.triggerManualUsCodeIndexing(type, userId);
  }

  /**
   * Update unified scheduler configuration with hot-reload support
   */
  async updateConfiguration(newConfig: Partial<SchedulerConfig>): Promise<void> {
    const oldConfig = { ...this.config };
    
    // Update configuration in memory first
    Object.assign(this.config, newConfig);
    
    // Save to system settings with error handling
    const settingsPromises = [];
    
    // US Code settings
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
    
    // UCC settings
    if (newConfig.uccEnabled !== undefined) {
      settingsPromises.push(storage.setSystemSetting('ucc_scheduler_enabled', newConfig.uccEnabled));
    }
    if (newConfig.uccSchedule !== undefined) {
      settingsPromises.push(storage.setSystemSetting('ucc_scheduler_schedule', newConfig.uccSchedule));
    }
    if (newConfig.uccIncrementalEnabled !== undefined) {
      settingsPromises.push(storage.setSystemSetting('ucc_scheduler_incremental_enabled', newConfig.uccIncrementalEnabled));
    }
    if (newConfig.uccPriorityArticles !== undefined) {
      settingsPromises.push(storage.setSystemSetting('ucc_scheduler_priority_articles', newConfig.uccPriorityArticles));
    }
    if (newConfig.uccMaxRetries !== undefined) {
      settingsPromises.push(storage.setSystemSetting('ucc_scheduler_max_retries', newConfig.uccMaxRetries));
    }
    if (newConfig.uccTimeoutMinutes !== undefined) {
      settingsPromises.push(storage.setSystemSetting('ucc_scheduler_timeout_minutes', newConfig.uccTimeoutMinutes));
    }
    if (newConfig.uccNotifyOnFailure !== undefined) {
      settingsPromises.push(storage.setSystemSetting('ucc_scheduler_notify_on_failure', newConfig.uccNotifyOnFailure));
    }
    
    // Unified settings
    if (newConfig.concurrentExecution !== undefined) {
      settingsPromises.push(storage.setSystemSetting('legal_scheduler_concurrent_execution', newConfig.concurrentExecution));
    }
    if (newConfig.resourceThrottling !== undefined) {
      settingsPromises.push(storage.setSystemSetting('legal_scheduler_resource_throttling', newConfig.resourceThrottling));
    }
    
    // Apply settings with error handling
    await apiErrorHandler.executeWithRetry(async () => {
      await Promise.all(settingsPromises);
    }, 'updateUnifiedSchedulerConfiguration-saveSettings');
    
    // Restart schedulers if critical settings changed
    const needsUsCodeRestart = (
      (newConfig.enabled !== undefined && newConfig.enabled !== oldConfig.enabled) ||
      (newConfig.schedule !== undefined && newConfig.schedule !== oldConfig.schedule)
    );
    
    const needsUccRestart = (
      (newConfig.uccEnabled !== undefined && newConfig.uccEnabled !== oldConfig.uccEnabled) ||
      (newConfig.uccSchedule !== undefined && newConfig.uccSchedule !== oldConfig.uccSchedule)
    );
    
    try {
      if (needsUsCodeRestart) {
        this.stopUsCodeScheduler();
        if (this.config.enabled) {
          await this.startUsCodeScheduler();
          log(`[UnifiedLegalScheduler] US Code scheduler restarted`);
        }
      }
      
      if (needsUccRestart) {
        this.stopUccScheduler();
        if (this.config.uccEnabled) {
          await this.startUccScheduler();
          log(`[UnifiedLegalScheduler] UCC scheduler restarted`);
        }
      }
    } catch (error) {
      log(`[UnifiedLegalScheduler] Error restarting schedulers: ${error}`);
      // Rollback configuration on restart failure
      Object.assign(this.config, oldConfig);
      throw new Error(`Failed to apply configuration changes: ${error}`);
    }
    
    // Update next run times
    this.updateUsCodeNextRunTime();
    this.updateUccNextRunTime();
    this.updateOverallHealth();
    
    log(`[UnifiedLegalScheduler] Configuration updated successfully`);
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
export const unifiedLegalScheduler = new UnifiedLegalScheduler();

// Export legacy alias for backward compatibility
export const usCodeScheduler = unifiedLegalScheduler;

// Export health check functions
export function getSchedulerHealth() {
  return unifiedLegalScheduler.getHealth();
}

export function getUnifiedLegalSchedulerHealth() {
  return unifiedLegalScheduler.getHealth();
}

// Export manual trigger functions
export async function triggerManualIndexing(type: 'full' | 'incremental', userId: string) {
  return unifiedLegalScheduler.triggerManualIndexing(type, userId);
}

export async function triggerManualUsCodeIndexing(type: 'full' | 'incremental', userId: string) {
  return unifiedLegalScheduler.triggerManualUsCodeIndexing(type, userId);
}

export async function triggerManualUccIndexing(type: 'full' | 'incremental' | 'article', userId: string, articleNumber?: string) {
  return unifiedLegalScheduler.triggerManualUccIndexing(type, userId, articleNumber);
}

// Export configuration update function
export async function updateSchedulerConfiguration(config: Partial<SchedulerConfig>) {
  return unifiedLegalScheduler.updateConfiguration(config);
}