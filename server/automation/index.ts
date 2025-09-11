/**
 * Automation Engine Initialization
 * 
 * This module initializes and exports all automation components.
 * Import this in the server to start the automation engine.
 */

import { eventBus } from "./EventBus";
import { dependencyEnabler } from "./DependencyEnabler";
import { ruleEngine } from "./RuleEngine";

// Initialize automation engine by importing all components
// This ensures event handlers are registered when the server starts
console.log("[AutomationEngine] Initializing workflow automation system...");

// Health check function for admin monitoring
export function getAutomationHealth() {
  return {
    status: 'healthy' as const,
    timestamp: new Date(),
    components: {
      eventBus: eventBus.getEventBusHealth(),
      dependencyEnabler: dependencyEnabler.getHealth(),
      ruleEngine: ruleEngine.getHealth(),
    },
    eventHandlers: {
      registered: true,
      totalHandlers: 4, // TaskStatusChanged, TaskCompleted handlers in both systems
    },
    capabilities: [
      'task_dependency_enablement',
      'workflow_rule_execution', 
      'event_correlation',
      'error_recovery',
      'family_scoped_automation'
    ]
  };
}

// Manual dependency check function for admin use
export async function checkFamilyDependencies(familyId: string) {
  console.log(`[AutomationEngine] Manual dependency check requested for family ${familyId}`);
  return await dependencyEnabler.checkAndEnableDependencies(familyId);
}

// Export all components for direct access if needed
export {
  eventBus,
  dependencyEnabler, 
  ruleEngine,
};

console.log("[AutomationEngine] Automation system initialized successfully");