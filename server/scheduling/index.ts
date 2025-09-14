/**
 * Unified Legal Content Scheduler System Initialization
 * 
 * This module initializes and exports the unified legal content scheduler system
 * which handles both US Code and UCC indexing operations.
 * Import this in the server to start the scheduler.
 */

import { unifiedLegalScheduler, usCodeScheduler, getUnifiedLegalSchedulerHealth } from './USCodeScheduler';
import { log } from '../vite';
import { storage } from '../storage';

// Initialize unified legal content scheduler system
console.log("[Scheduler] Initializing unified legal content scheduler...");

/**
 * Initialize default UCC system settings if they don't exist
 */
async function initializeUccDefaultSettings(): Promise<void> {
  try {
    const uccSettings = [
      { key: 'ucc_scheduler_enabled', value: true, description: 'Enable UCC indexing scheduler' },
      { key: 'ucc_scheduler_schedule', value: '30 2 * * *', description: 'UCC indexing cron schedule (2:30 AM daily)' },
      { key: 'ucc_scheduler_incremental_enabled', value: true, description: 'Enable UCC incremental indexing' },
      { key: 'ucc_scheduler_priority_articles', value: ['1', '9'], description: 'Priority UCC articles for indexing' },
      { key: 'ucc_scheduler_max_retries', value: 3, description: 'Maximum retries for UCC indexing jobs' },
      { key: 'ucc_scheduler_timeout_minutes', value: 120, description: 'UCC indexing job timeout in minutes' },
      { key: 'ucc_scheduler_notify_on_failure', value: true, description: 'Send notifications on UCC indexing failures' },
      { key: 'legal_scheduler_concurrent_execution', value: false, description: 'Allow concurrent US Code and UCC indexing' },
      { key: 'legal_scheduler_resource_throttling', value: true, description: 'Enable resource throttling for legal content indexing' }
    ];

    for (const setting of uccSettings) {
      const existing = await storage.getSystemSetting(setting.key);
      if (!existing) {
        await storage.upsertSystemSetting({
          key: setting.key,
          value: setting.value,
          category: 'scheduler',
          description: setting.description
        });
        log(`[Scheduler] Created default UCC setting: ${setting.key} = ${setting.value}`);
      }
    }

    log("[Scheduler] UCC default settings initialization complete");
  } catch (error) {
    log(`[Scheduler] Warning: Failed to initialize UCC default settings: ${error}`);
  }
}

// Health check function for admin monitoring
export function getSchedulingSystemHealth() {
  const health = getUnifiedLegalSchedulerHealth();
  
  return {
    status: 'healthy' as const,
    timestamp: new Date(),
    components: {
      unifiedScheduler: health,
    },
    capabilities: [
      'uscode_daily_reindexing',
      'uscode_incremental_updates',
      'ucc_daily_reindexing', 
      'ucc_incremental_updates',
      'ucc_article_specific_updates',
      'concurrent_execution',
      'sequential_execution',
      'manual_triggering',
      'admin_configuration',
      'unified_health_monitoring'
    ]
  };
}

// Initialize the unified scheduler on import
let initializationPromise: Promise<void> | null = null;

export async function initializeScheduler(): Promise<void> {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      // Initialize UCC default settings first
      await initializeUccDefaultSettings();
      
      // Initialize the unified scheduler
      await unifiedLegalScheduler.initialize();
      log("[Scheduler] Unified legal content scheduler initialized successfully");
    } catch (error) {
      log(`[Scheduler] Failed to initialize unified scheduler: ${error}`);
    }
  })();

  return initializationPromise;
}

// Export scheduler instances for direct access
export { unifiedLegalScheduler, usCodeScheduler };

// Auto-initialize when module is imported (similar to automation system)
initializeScheduler().catch(error => {
  console.error("[Scheduler] Failed to auto-initialize unified scheduler:", error);
});

console.log("[Scheduler] Unified legal content scheduler system initialization complete");