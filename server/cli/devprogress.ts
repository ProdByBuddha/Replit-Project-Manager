#!/usr/bin/env node

import { Command } from 'commander';
import { DevProgressService } from '../services/devProgress';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
config();

const program = new Command();
const devProgress = new DevProgressService();

// Helper to parse multiple values
function collect(value: string, previous: string[]) {
  return previous.concat([value]);
}

// Helper to save last report
function saveLastReport(report: any) {
  const reportDir = path.join(process.cwd(), '.dart-reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  const reportFile = path.join(reportDir, 'last-report.json');
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`💾 Report saved to ${reportFile}`);
}

// Helper to load last report
function loadLastReport(): any {
  const reportFile = path.join(process.cwd(), '.dart-reports', 'last-report.json');
  if (fs.existsSync(reportFile)) {
    return JSON.parse(fs.readFileSync(reportFile, 'utf-8'));
  }
  return null;
}

// Configure the program
program
  .name('devprogress')
  .description('Developer Progress Reporting Tool for Dart')
  .version('1.0.0');

// Command: Status
program
  .command('status')
  .description('Check Dart integration status')
  .action(async () => {
    console.log('🔍 Checking Dart integration status...\n');
    
    const status = await devProgress.status();
    
    console.log('📊 Dart Integration Status');
    console.log('─'.repeat(40));
    console.log(`✅ Configured: ${status.configured ? 'Yes' : 'No (Set DART_API_KEY)'}`);
    console.log(`📁 Workspace ID: ${status.workspaceId}`);
    console.log(`📋 Project ID: ${status.projectId}`);
    console.log(`🌐 API Endpoint: ${status.apiEndpoint}`);
    
    if (!status.configured) {
      console.log('\n⚠️  To enable Dart integration, set the DART_API_KEY environment variable');
    }
  });

// Command: Preview
program
  .command('preview')
  .description('Preview a progress report without sending')
  .option('-s, --summary <text>', 'Executive summary of the update')
  .option('-a, --added <item>', 'New feature or addition (can be used multiple times)', collect, [])
  .option('-f, --fixed <item>', 'Bug fix (can be used multiple times)', collect, [])
  .option('-i, --improved <item>', 'Improvement (can be used multiple times)', collect, [])
  .option('-n, --next <item>', 'Next step (can be used multiple times)', collect, [])
  .option('--load', 'Load and preview the last saved report')
  .action(async (options) => {
    let update;
    
    if (options.load) {
      const lastReport = loadLastReport();
      if (!lastReport) {
        console.error('❌ No saved report found. Create one first with preview or send command.');
        process.exit(1);
      }
      update = lastReport;
      console.log('📂 Loaded last saved report\n');
    } else {
      // Validate that at least something is provided
      if (!options.summary && options.added.length === 0 && 
          options.fixed.length === 0 && options.improved.length === 0) {
        console.error('❌ Please provide at least a summary or some update items');
        console.log('\nExample usage:');
        console.log('  npx tsx server/cli/devprogress.ts preview \\');
        console.log('    --summary "Completed user authentication system" \\');
        console.log('    --added "Login with email/password" \\');
        console.log('    --added "Remember me functionality" \\');
        console.log('    --fixed "Session timeout issue"');
        process.exit(1);
      }
      
      update = {
        summary: options.summary,
        added: options.added.length > 0 ? options.added : undefined,
        fixed: options.fixed.length > 0 ? options.fixed : undefined,
        improved: options.improved.length > 0 ? options.improved : undefined,
        nextSteps: options.next.length > 0 ? options.next : undefined,
      };
      
      // Save the report
      saveLastReport(update);
    }
    
    console.log('👁️  Progress Report Preview');
    console.log('═'.repeat(60));
    console.log();
    
    const message = devProgress.previewUpdate(update);
    console.log(message);
    
    console.log();
    console.log('═'.repeat(60));
    
    const wordCount = message.split(/\s+/).length;
    console.log(`📝 Word count: ${wordCount} ${wordCount > 300 ? '⚠️  (recommended: under 300)' : '✅'}`);
    console.log('\n💡 To send this report, use: npx tsx server/cli/devprogress.ts send --load');
  });

// Command: Send
program
  .command('send')
  .description('Send a progress report to Dart')
  .option('-s, --summary <text>', 'Executive summary of the update')
  .option('-a, --added <item>', 'New feature or addition (can be used multiple times)', collect, [])
  .option('-f, --fixed <item>', 'Bug fix (can be used multiple times)', collect, [])
  .option('-i, --improved <item>', 'Improvement (can be used multiple times)', collect, [])
  .option('-n, --next <item>', 'Next step (can be used multiple times)', collect, [])
  .option('--load', 'Load and send the last saved report')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (options) => {
    if (!devProgress.isConfigured()) {
      console.error('❌ Dart API not configured. Set DART_API_KEY environment variable.');
      process.exit(1);
    }
    
    let update;
    
    if (options.load) {
      const lastReport = loadLastReport();
      if (!lastReport) {
        console.error('❌ No saved report found. Create one first with preview command.');
        process.exit(1);
      }
      update = lastReport;
      console.log('📂 Loaded last saved report\n');
    } else {
      // Validate that at least something is provided
      if (!options.summary && options.added.length === 0 && 
          options.fixed.length === 0 && options.improved.length === 0) {
        console.error('❌ Please provide at least a summary or some update items');
        console.log('\nExample usage:');
        console.log('  npx tsx server/cli/devprogress.ts send \\');
        console.log('    --summary "Completed API integration" \\');
        console.log('    --added "RESTful endpoints for user management" \\');
        console.log('    --fixed "Rate limiting issue"');
        process.exit(1);
      }
      
      update = {
        summary: options.summary,
        added: options.added.length > 0 ? options.added : undefined,
        fixed: options.fixed.length > 0 ? options.fixed : undefined,
        improved: options.improved.length > 0 ? options.improved : undefined,
        nextSteps: options.next.length > 0 ? options.next : undefined,
      };
      
      // Save the report
      saveLastReport(update);
    }
    
    // Show preview
    console.log('📤 Preparing to send progress report...\n');
    const message = devProgress.previewUpdate(update);
    console.log('─'.repeat(60));
    console.log(message);
    console.log('─'.repeat(60));
    console.log();
    
    // Confirm before sending (unless -y flag is used)
    if (!options.yes) {
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise<string>((resolve) => {
        readline.question('Send this report? (y/n): ', resolve);
      });
      readline.close();
      
      if (answer.toLowerCase() !== 'y') {
        console.log('❌ Report cancelled');
        process.exit(0);
      }
    }
    
    // Send the report
    console.log('\n🚀 Sending report to Dart...');
    const success = await devProgress.sendProgressUpdate(update);
    
    if (success) {
      console.log('✅ Report sent successfully!');
      
      // Archive the sent report
      const reportDir = path.join(process.cwd(), '.dart-reports');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const archiveFile = path.join(reportDir, `report-${timestamp}.json`);
      fs.writeFileSync(archiveFile, JSON.stringify({
        ...update,
        sentAt: new Date().toISOString(),
        success: true,
      }, null, 2));
      console.log(`📁 Report archived to ${archiveFile}`);
    } else {
      console.error('❌ Failed to send report. Check your API key and try again.');
      process.exit(1);
    }
  });

// Command: Quick (shorthand for common updates)
program
  .command('quick <type>')
  .description('Send a quick pre-formatted update (deploy, hotfix, feature, milestone)')
  .argument('<type>', 'Type of update: deploy, hotfix, feature, or milestone')
  .option('-m, --message <text>', 'Additional context or details')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (type, options) => {
    if (!devProgress.isConfigured()) {
      console.error('❌ Dart API not configured. Set DART_API_KEY environment variable.');
      process.exit(1);
    }
    
    let update;
    const timestamp = new Date().toLocaleString();
    
    switch (type) {
      case 'deploy':
        update = {
          summary: `Production deployment completed at ${timestamp}`,
          added: options.message ? [options.message] : ['Latest features deployed to production'],
          improved: ['System stability and performance'],
        };
        break;
        
      case 'hotfix':
        update = {
          summary: `Critical hotfix deployed at ${timestamp}`,
          fixed: options.message ? [options.message] : ['Critical issue resolved'],
          improved: ['System reliability'],
        };
        break;
        
      case 'feature':
        update = {
          summary: options.message || 'New feature completed and ready for testing',
          added: ['New functionality as discussed'],
          nextSteps: ['Testing and feedback collection'],
        };
        break;
        
      case 'milestone':
        update = {
          summary: options.message || 'Project milestone achieved',
          improved: ['Overall project progress'],
          nextSteps: ['Moving to next phase of development'],
        };
        break;
        
      default:
        console.error(`❌ Unknown quick update type: ${type}`);
        console.log('Available types: deploy, hotfix, feature, milestone');
        process.exit(1);
    }
    
    // Show what will be sent
    console.log(`📤 Sending ${type} update...\n`);
    const message = devProgress.previewUpdate(update);
    console.log('─'.repeat(60));
    console.log(message);
    console.log('─'.repeat(60));
    console.log();
    
    // Confirm unless -y flag
    if (!options.yes) {
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise<string>((resolve) => {
        readline.question('Send this report? (y/n): ', resolve);
      });
      readline.close();
      
      if (answer.toLowerCase() !== 'y') {
        console.log('❌ Report cancelled');
        process.exit(0);
      }
    }
    
    // Send the report
    console.log('\n🚀 Sending report to Dart...');
    const success = await devProgress.sendProgressUpdate(update);
    
    if (success) {
      console.log(`✅ ${type} update sent successfully!`);
    } else {
      console.error('❌ Failed to send update. Check your API key and try again.');
      process.exit(1);
    }
  });

// Show examples if no command provided
if (!process.argv.slice(2).length) {
  console.log('📊 Developer Progress Reporting Tool for Dart\n');
  console.log('Examples:\n');
  console.log('  Check status:');
  console.log('    npx tsx server/cli/devprogress.ts status\n');
  console.log('  Preview a report:');
  console.log('    npx tsx server/cli/devprogress.ts preview \\');
  console.log('      --summary "Completed authentication system" \\');
  console.log('      --added "OAuth integration" \\');
  console.log('      --fixed "Session timeout bug"\n');
  console.log('  Send a report:');
  console.log('    npx tsx server/cli/devprogress.ts send \\');
  console.log('      --summary "API v2 ready for testing" \\');
  console.log('      --added "New endpoints" \\');
  console.log('      --improved "Response times"\n');
  console.log('  Quick updates:');
  console.log('    npx tsx server/cli/devprogress.ts quick deploy');
  console.log('    npx tsx server/cli/devprogress.ts quick hotfix -m "Fixed payment processing"');
  console.log('    npx tsx server/cli/devprogress.ts quick feature -m "Chat system implemented"');
  console.log('    npx tsx server/cli/devprogress.ts quick milestone -m "Phase 1 complete"\n');
  console.log('Use --help with any command for more options.');
}

// Parse arguments
program.parse();