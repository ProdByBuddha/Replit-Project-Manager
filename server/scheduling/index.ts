/**
 * Scheduler System Initialization
 * 
 * This module initializes and exports the US Code scheduler system.
 * Import this in the server to start the scheduler.
 */

import { usCodeScheduler, getSchedulerHealth } from './USCodeScheduler';
import { log } from '../vite';

// Initialize scheduler system
console.log("[Scheduler] Initializing US Code re-indexing scheduler...");

// Health check function for admin monitoring
export function getSchedulingSystemHealth() {
  return {
    status: 'healthy' as const,
    timestamp: new Date(),
    components: {
      scheduler: getSchedulerHealth(),
    },
    capabilities: [
      'daily_reindexing',
      'incremental_updates', 
      'manual_triggering',
      'admin_configuration',
      'health_monitoring'
    ]
  };
}

// Initialize the scheduler on import
let initializationPromise: Promise<void> | null = null;

export async function initializeScheduler(): Promise<void> {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      await usCodeScheduler.initialize();
      log("[Scheduler] US Code scheduler initialized successfully");
    } catch (error) {
      log(`[Scheduler] Failed to initialize scheduler: ${error}`);
    }
  })();

  return initializationPromise;
}

// Export scheduler instance for direct access
export { usCodeScheduler };

// Auto-initialize when module is imported (similar to automation system)
initializeScheduler().catch(error => {
  console.error("[Scheduler] Failed to auto-initialize scheduler:", error);
});

console.log("[Scheduler] Scheduler system initialization complete");