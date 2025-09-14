#!/usr/bin/env node

import { Command } from 'commander';
import { DartAIService } from '../services/dartai';
import { storage } from '../storage';
import { db } from '../db';
import { families, familyTasks, tasks, dartProjects, dartTasks } from '@shared/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { config } from 'dotenv';

// Load environment variables
config();

const program = new Command();
const dartService = new DartAIService();

// Helper function to calculate progress stats
async function calculateFamilyProgress(familyId: string) {
  const familyTaskList = await storage.getFamilyTasks(familyId);
  
  const stats = {
    total: familyTaskList.length,
    completed: 0,
    inProgress: 0,
    todo: 0,
    blocked: 0,
  };
  
  const recentCompletions: string[] = [];
  
  // Sort by completed date to get recent completions
  const completedTasks = familyTaskList
    .filter(ft => ft.status === 'completed' && ft.completedAt)
    .sort((a, b) => {
      const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, 5);
  
  completedTasks.forEach(ft => {
    recentCompletions.push(ft.task.title);
  });
  
  // Count task statuses
  familyTaskList.forEach(ft => {
    switch (ft.status) {
      case 'completed':
        stats.completed++;
        break;
      case 'in_progress':
        stats.inProgress++;
        break;
      case 'blocked':
        stats.blocked++;
        break;
      default:
        stats.todo++;
    }
  });
  
  const progressPercentage = stats.total > 0 
    ? Math.round((stats.completed / stats.total) * 100)
    : 0;
  
  return {
    stats,
    progressPercentage,
    recentCompletions,
  };
}

// Command: Report progress for a family
program
  .command('report')
  .description('Send a progress report for a family to Dart')
  .requiredOption('--family <id>', 'Family ID to report on')
  .action(async (options) => {
    try {
      if (!dartService.isConfigured()) {
        console.error('❌ Dart AI service not configured. Please set DART_API_KEY environment variable.');
        process.exit(1);
      }
      
      const familyId = options.family;
      console.log(`📊 Generating progress report for family: ${familyId}`);
      
      // Get family information
      const family = await storage.getFamily(familyId);
      if (!family) {
        console.error(`❌ Family not found: ${familyId}`);
        process.exit(1);
      }
      
      // Calculate progress
      const { stats, progressPercentage, recentCompletions } = await calculateFamilyProgress(familyId);
      
      // Get or create Dart project
      const projectName = `${family.name} - Status Correction`;
      const dartProject = await dartService.ensureFamilyProject(familyId, projectName);
      
      if (!dartProject) {
        console.error('❌ Failed to create/get Dart project');
        process.exit(1);
      }
      
      // Send progress report
      const report = {
        projectName,
        timestamp: new Date(),
        stats,
        progressPercentage,
        recentCompletions,
        lastUpdated: new Date(),
      };
      
      const success = await dartService.sendProjectProgressReport(dartProject.dartProjectId, report);
      
      if (success) {
        console.log('✅ Progress report sent successfully');
        console.log(`   Total: ${stats.total} tasks`);
        console.log(`   Completed: ${stats.completed} (${progressPercentage}%)`);
        console.log(`   In Progress: ${stats.inProgress}`);
        console.log(`   Todo: ${stats.todo}`);
        console.log(`   Blocked: ${stats.blocked}`);
        if (recentCompletions.length > 0) {
          console.log(`   Recent completions:`);
          recentCompletions.forEach(task => console.log(`     • ${task}`));
        }
      } else {
        console.error('❌ Failed to send progress report');
        process.exit(1);
      }
      
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

// Command: Sync tasks for a family
program
  .command('sync')
  .description('Sync all tasks for a family to Dart')
  .requiredOption('--family <id>', 'Family ID to sync')
  .action(async (options) => {
    try {
      if (!dartService.isConfigured()) {
        console.error('❌ Dart AI service not configured. Please set DART_API_KEY environment variable.');
        process.exit(1);
      }
      
      const familyId = options.family;
      console.log(`🔄 Syncing tasks for family: ${familyId}`);
      
      // Get family information
      const family = await storage.getFamily(familyId);
      if (!family) {
        console.error(`❌ Family not found: ${familyId}`);
        process.exit(1);
      }
      
      // Sync family to Dart
      const result = await dartService.syncFamily(familyId);
      
      if (result.success) {
        console.log('✅ Sync completed successfully');
        console.log(`   Tasks synced: ${result.tasksSynced}`);
        console.log(`   Tasks failed: ${result.tasksFailed}`);
        if (result.errors && result.errors.length > 0) {
          console.log('   Errors:');
          result.errors.forEach(err => console.log(`     • ${err}`));
        }
      } else {
        console.error('❌ Sync failed');
        if (result.errors && result.errors.length > 0) {
          console.log('   Errors:');
          result.errors.forEach(err => console.log(`     • ${err}`));
        }
        process.exit(1);
      }
      
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

// Command: Backfill all families
program
  .command('backfill')
  .description('Sync all families and their tasks to Dart')
  .option('--limit <number>', 'Limit number of families to sync', parseInt)
  .action(async (options) => {
    try {
      if (!dartService.isConfigured()) {
        console.error('❌ Dart AI service not configured. Please set DART_API_KEY environment variable.');
        process.exit(1);
      }
      
      console.log('🔄 Starting backfill for all families...');
      
      // Get all families
      const allFamilies = await storage.getAllFamilies();
      const familiesToSync = options.limit 
        ? allFamilies.slice(0, options.limit)
        : allFamilies;
      
      console.log(`Found ${familiesToSync.length} families to sync`);
      
      let successCount = 0;
      let failCount = 0;
      let totalTasksSynced = 0;
      
      for (const family of familiesToSync) {
        console.log(`\nSyncing family: ${family.name} (${family.id})`);
        
        try {
          const result = await dartService.syncFamily(family.id);
          
          if (result.success) {
            successCount++;
            totalTasksSynced += result.tasksSynced || 0;
            console.log(`  ✅ Success - ${result.tasksSynced} tasks synced`);
          } else {
            failCount++;
            console.log(`  ❌ Failed`);
            if (result.errors && result.errors.length > 0) {
              result.errors.forEach(err => console.log(`     • ${err}`));
            }
          }
        } catch (error) {
          failCount++;
          console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      console.log('\n📊 Backfill Summary:');
      console.log(`   Families processed: ${familiesToSync.length}`);
      console.log(`   Successful: ${successCount}`);
      console.log(`   Failed: ${failCount}`);
      console.log(`   Total tasks synced: ${totalTasksSynced}`);
      
      if (failCount > 0) {
        process.exit(1);
      }
      
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

// Command: Status - check Dart connection and stats
program
  .command('status')
  .description('Check Dart AI service status and statistics')
  .action(async () => {
    try {
      console.log('🔍 Checking Dart AI service status...\n');
      
      // Check configuration
      if (!dartService.isConfigured()) {
        console.log('❌ Service Status: Not Configured');
        console.log('   DART_API_KEY is not set in environment variables');
        process.exit(1);
      }
      
      console.log('✅ Service Status: Configured');
      
      // Get sync statistics from database
      const [syncStats] = await db
        .select({
          totalProjects: sql<number>`COUNT(DISTINCT ${dartProjects.id})`,
          totalTasks: sql<number>`COUNT(DISTINCT ${dartTasks.id})`,
          syncedTasks: sql<number>`COUNT(DISTINCT CASE WHEN ${dartTasks.syncStatus} = 'synced' THEN ${dartTasks.id} END)`,
          pendingTasks: sql<number>`COUNT(DISTINCT CASE WHEN ${dartTasks.syncStatus} = 'pending' THEN ${dartTasks.id} END)`,
          failedTasks: sql<number>`COUNT(DISTINCT CASE WHEN ${dartTasks.syncStatus} = 'failed' THEN ${dartTasks.id} END)`,
        })
        .from(dartTasks)
        .leftJoin(dartProjects, eq(dartTasks.dartProjectId, dartProjects.dartProjectId));
      
      console.log('\n📊 Synchronization Statistics:');
      console.log(`   Projects: ${syncStats?.totalProjects || 0}`);
      console.log(`   Total Tasks: ${syncStats?.totalTasks || 0}`);
      console.log(`   • Synced: ${syncStats?.syncedTasks || 0}`);
      console.log(`   • Pending: ${syncStats?.pendingTasks || 0}`);
      console.log(`   • Failed: ${syncStats?.failedTasks || 0}`);
      
      // Get last sync times
      const recentSyncs = await db
        .select({
          entityType: dartTasks.syncStatus,
          lastSync: sql<Date>`MAX(${dartTasks.lastSyncAt})`,
        })
        .from(dartTasks)
        .groupBy(dartTasks.syncStatus)
        .limit(5);
      
      if (recentSyncs.length > 0) {
        console.log('\n🕐 Recent Sync Activity:');
        recentSyncs.forEach(sync => {
          if (sync.lastSync) {
            const timeAgo = getTimeAgo(new Date(sync.lastSync));
            console.log(`   ${sync.entityType}: ${timeAgo}`);
          }
        });
      }
      
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

// Helper function to format time ago
function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return `${days} days ago`;
}

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}