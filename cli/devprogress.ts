#!/usr/bin/env node

import { Command } from 'commander';
import { DevProgressService } from '../src/progress/dartProgress.js';
import { GitIntegratedProgressService } from '../src/git/gitIntegration.js';
import 'dotenv/config';

const program = new Command();

program
  .name('rpm-devprogress')
  .description('Development progress reporting for Dart AI')
  .version('1.0.0');

// Test connection command
program
  .command('test')
  .description('Test connection to Dart AI')
  .action(async () => {
    try {
      const devProgressService = DevProgressService.getInstance();
      
      if (!devProgressService.isConfigured()) {
        console.error('❌ DART_TOKEN not configured. Please set the DART_TOKEN environment variable.');
        process.exit(1);
      }
      
      console.log('🔍 Testing connection to Dart AI...');
      const success = await devProgressService.testConnection();
      
      if (success) {
        console.log('✅ Successfully connected to Dart AI');
      } else {
        console.log('❌ Failed to connect to Dart AI');
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Error testing connection:', error);
      process.exit(1);
    }
  });

// Send progress update command
program
  .command('send')
  .description('Send progress update to Dart AI')
  .option('-s, --summary <text>', 'Progress summary (required)')
  .option('-a, --added [items...]', 'New features added')
  .option('-f, --fixed [items...]', 'Issues fixed')
  .option('-i, --improved [items...]', 'Improvements made')
  .option('-n, --next-steps [items...]', 'Next steps planned')
  .option('--no-savings', 'Disable automatic savings calculation')
  .option('--workspace-id <id>', 'Dart workspace ID')
  .option('--dartboard <name>', 'Dart dartboard name')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (options) => {
    try {
      if (!options.summary) {
        console.error('❌ Error: --summary is required');
        process.exit(1);
      }

      // Configure service if workspace/dartboard provided
      const config: any = {};
      if (options.workspaceId) config.workspaceId = options.workspaceId;
      if (options.dartboard) config.dartboard = options.dartboard;
      
      const devProgressService = DevProgressService.getInstance(config);
      
      if (!devProgressService.isConfigured()) {
        console.error('❌ DART_TOKEN not configured. Please set the DART_TOKEN environment variable.');
        process.exit(1);
      }

      // Set up git integration for savings if enabled
      if (options.savings !== false) {
        const gitService = GitIntegratedProgressService.getInstance();
        devProgressService.setGitService(gitService);
      }

      const update = {
        summary: options.summary,
        added: options.added || [],
        fixed: options.fixed || [],
        improved: options.improved || [],
        nextSteps: options.nextSteps || []
      };

      // Show preview
      console.log('💾 Report saved to .dart-reports/last-report.json');
      console.log('📤 Preparing to send progress report...\n');
      
      console.log('────────────────────────────────────────────────────────────');
      console.log('📊 Development Progress Update');
      console.log(new Date().toLocaleDateString());
      console.log('');
      console.log('**Executive Summary**');
      console.log(update.summary);
      console.log('');
      
      if (update.added.length > 0) {
        console.log('✨ **What\'s New**');
        update.added.forEach((item: string) => console.log(`• ${item}`));
        console.log('');
      }
      
      if (update.improved.length > 0) {
        console.log('🚀 **Improvements**');
        update.improved.forEach((item: string) => console.log(`• ${item}`));
        console.log('');
      }
      
      if (update.fixed.length > 0) {
        console.log('🐛 **Bug Fixes**');
        update.fixed.forEach((item: string) => console.log(`• ${item}`));
        console.log('');
      }
      
      if (update.nextSteps.length > 0) {
        console.log('📋 **Next Steps**');
        update.nextSteps.forEach((item: string) => console.log(`• ${item}`));
        console.log('');
      }
      
      console.log('---');
      console.log('*This update was generated automatically from the development team.*');
      console.log('────────────────────────────────────────────────────────────\n');

      // Confirm sending
      if (!options.yes) {
        const readline = await import('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        const answer = await new Promise<string>((resolve) => {
          rl.question('🚀 Send this report to Dart AI? (y/N): ', resolve);
        });
        rl.close();
        
        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
          console.log('📋 Report cancelled.');
          process.exit(0);
        }
      }

      console.log('🚀 Sending report to Dart...');
      const success = await devProgressService.sendProgressUpdate(update);
      
      if (success) {
        console.log('✅ Report sent successfully!');
        console.log('📁 Report archived to .dart-reports/');
      } else {
        console.log('❌ Failed to send report');
        process.exit(1);
      }
      
    } catch (error) {
      console.error('❌ Error sending progress update:', error);
      process.exit(1);
    }
  });

// Quick update command
program
  .command('quick')
  .description('Send a quick progress update')
  .option('-m, --message <text>', 'Quick update message (required)')
  .option('-d, --days <number>', 'Number of days to include in analysis', '7')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (options) => {
    try {
      if (!options.message) {
        console.error('❌ Error: --message is required');
        process.exit(1);
      }

      const devProgressService = DevProgressService.getInstance();
      
      if (!devProgressService.isConfigured()) {
        console.error('❌ DART_TOKEN not configured. Please set the DART_TOKEN environment variable.');
        process.exit(1);
      }

      // Set up git integration
      const gitService = GitIntegratedProgressService.getInstance();
      devProgressService.setGitService(gitService);

      console.log(`🚀 Sending quick progress update for last ${options.days} days...`);
      
      const success = await devProgressService.sendQuickUpdate(options.message);
      
      if (success) {
        console.log('✅ Quick update sent successfully!');
      } else {
        console.log('❌ Failed to send quick update');
        process.exit(1);
      }
      
    } catch (error) {
      console.error('❌ Error sending quick update:', error);
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Check service configuration and connection')
  .action(async () => {
    try {
      const devProgressService = DevProgressService.getInstance();
      
      console.log('\n📊 REPLIT PROJECT MANAGER STATUS');
      console.log('='.repeat(40));
      
      if (devProgressService.isConfigured()) {
        console.log('✅ DART_TOKEN: Configured');
        
        console.log('🔍 Testing connection...');
        const connected = await devProgressService.testConnection();
        console.log(`📡 Dart AI Connection: ${connected ? '✅ Connected' : '❌ Failed'}`);
      } else {
        console.log('❌ DART_TOKEN: Not configured');
        console.log('💡 Set DART_TOKEN environment variable to enable Dart AI integration');
      }
      
      console.log('='.repeat(40));
      
    } catch (error) {
      console.error('❌ Error checking status:', error);
      process.exit(1);
    }
  });

// Help command
program
  .command('help-examples')
  .description('Show usage examples')
  .action(() => {
    console.log('\n📖 DEVELOPMENT PROGRESS REPORTING EXAMPLES');
    console.log('='.repeat(50));
    console.log('');
    console.log('📤 Send comprehensive progress report:');
    console.log('  rpm-devprogress send --summary "Completed user authentication" --added "Login system" --fixed "Security issues"');
    console.log('');
    console.log('🚀 Quick progress update:');
    console.log('  rpm-devprogress quick --message "Fixed critical bug in payment system"');
    console.log('');
    console.log('🔍 Test connection:');
    console.log('  rpm-devprogress test');
    console.log('');
    console.log('📊 Check service status:');
    console.log('  rpm-devprogress status');
    console.log('');
    console.log('='.repeat(50));
  });

// Parse command line arguments
program.parse();