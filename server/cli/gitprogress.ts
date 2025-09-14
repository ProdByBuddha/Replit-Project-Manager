#!/usr/bin/env node

import { Command } from 'commander';
import { GitIntegratedProgressService } from '../services/gitIntegratedProgress.js';
import 'dotenv/config';

const program = new Command();
const gitProgressService = GitIntegratedProgressService.getInstance();

program
  .name('gitprogress')
  .description('Git-integrated development progress reporting for Dart AI')
  .version('1.0.0');

// Analyze git history command
program
  .command('analyze')
  .description('Analyze git history and display development categories')
  .option('-s, --since <period>', 'Time period to analyze (e.g., "1 month ago", "2 weeks ago")', '1 month ago')
  .option('-j, --json', 'Output results in JSON format')
  .action(async (options) => {
    try {
      console.log(`🔍 Analyzing git history since: ${options.since}`);
      const analysis = await gitProgressService.analyzeGitHistory(options.since);
      
      if (options.json) {
        console.log(JSON.stringify(analysis, null, 2));
      } else {
        // Display formatted analysis
        console.log('\n' + '='.repeat(60));
        console.log('📊 GIT HISTORY ANALYSIS');
        console.log('='.repeat(60));
        console.log(`📅 Period: ${analysis.dateRange}`);
        console.log(`📈 Total Commits: ${analysis.totalCommits}`);
        console.log(`📁 Files Changed: ${analysis.fileStats.filesChanged}`);
        console.log(`➕ Lines Added: ${analysis.fileStats.additions}`);
        console.log(`➖ Lines Removed: ${analysis.fileStats.deletions}`);
        
        console.log('\n🏗️ DEVELOPMENT CATEGORIES:');
        analysis.categories.forEach(category => {
          console.log(`  • ${category.name}: ${category.commits.length} commits`);
        });
        
        console.log('\n👥 TOP CONTRIBUTORS:');
        analysis.topContributors.forEach((contributor, index) => {
          console.log(`  ${index + 1}. ${contributor.author}: ${contributor.commits} commits`);
        });
        console.log('='.repeat(60));
      }
    } catch (error) {
      console.error('❌ Error analyzing git history:', error);
      process.exit(1);
    }
  });

// Generate cumulative report command
program
  .command('report')
  .description('Generate and send cumulative progress report')
  .option('-s, --since <period>', 'Time period to analyze', '1 month ago')
  .option('--no-send', 'Generate report but do not send to Dart AI')
  .option('-p, --preview', 'Preview report without sending')
  .action(async (options) => {
    try {
      const sendToDart = options.send && !options.preview;
      
      if (options.preview) {
        console.log('👀 Generating preview of cumulative progress report...');
      } else if (sendToDart) {
        console.log('📤 Generating and sending cumulative progress report...');
      } else {
        console.log('💾 Generating cumulative progress report (not sending)...');
      }
      
      await gitProgressService.generateCumulativeReport(options.since, sendToDart);
      
      if (options.preview) {
        console.log('\n✅ Preview complete! Use --no-preview to send the report.');
      } else if (sendToDart) {
        console.log('\n✅ Cumulative progress report sent to Dart AI successfully!');
      } else {
        console.log('\n✅ Report generated successfully!');
      }
      
    } catch (error) {
      console.error('❌ Error generating report:', error);
      process.exit(1);
    }
  });

// Git status command
program
  .command('status')
  .description('Display current git repository status')
  .action(async () => {
    try {
      const [status, branch] = await Promise.all([
        gitProgressService.getGitStatus(),
        gitProgressService.getCurrentBranch()
      ]);
      
      console.log('\n📊 GIT REPOSITORY STATUS');
      console.log('='.repeat(40));
      console.log(`🌿 Current Branch: ${branch}`);
      console.log(`📋 Working Directory: ${status === 'Working directory clean' ? '✅ Clean' : '⚠️ Modified files'}`);
      if (status !== 'Working directory clean') {
        console.log('\n📝 Modified Files:');
        console.log(status);
      }
      console.log('='.repeat(40));
      
    } catch (error) {
      console.error('❌ Error checking git status:', error);
      process.exit(1);
    }
  });

// Quick update command for immediate progress reporting
program
  .command('quick')
  .description('Quick progress update for recent changes')
  .option('-d, --days <number>', 'Number of days to include in report', '7')
  .option('-m, --message <text>', 'Custom summary message')
  .action(async (options) => {
    try {
      const sinceDate = `${options.days} days ago`;
      const analysis = await gitProgressService.analyzeGitHistory(sinceDate);
      
      if (analysis.totalCommits === 0) {
        console.log('📭 No commits found in the specified period.');
        return;
      }
      
      console.log(`🚀 Sending quick progress update for last ${options.days} days...`);
      
      const summary = options.message || 
        `Development progress update: ${analysis.totalCommits} commits over ${options.days} days across ${analysis.categories.length} feature areas`;
      
      // Generate categorized changes
      const gitService = GitIntegratedProgressService.getInstance();
      const { added, fixed, improved } = (gitService as any).categorizeChanges(analysis);
      
      const devProgressService = (gitService as any).devProgressService;
      await devProgressService.sendProgressUpdate({
        summary,
        added: added.slice(0, 5), // Limit to top 5
        fixed: fixed.slice(0, 5),
        improved: improved.slice(0, 5)
      });
      
      console.log('✅ Quick progress update sent successfully!');
      
    } catch (error) {
      console.error('❌ Error sending quick update:', error);
      process.exit(1);
    }
  });

// List recent commits command
program
  .command('commits')
  .description('List recent commits with categories')
  .option('-n, --number <count>', 'Number of commits to show', '20')
  .option('-s, --since <period>', 'Time period to show', '1 week ago')
  .action(async (options) => {
    try {
      const analysis = await gitProgressService.analyzeGitHistory(options.since);
      
      console.log('\n📋 RECENT COMMITS BY CATEGORY');
      console.log('='.repeat(60));
      
      analysis.categories.forEach(category => {
        if (category.commits.length === 0) return;
        
        console.log(`\n🏷️  ${category.name} (${category.commits.length} commits):`);
        category.commits.slice(0, parseInt(options.number)).forEach(commit => {
          console.log(`   ${commit.hash} - ${commit.date} - ${commit.message}`);
        });
      });
      
      console.log('='.repeat(60));
      
    } catch (error) {
      console.error('❌ Error listing commits:', error);
      process.exit(1);
    }
  });

// Help command
program
  .command('help-examples')
  .description('Show usage examples')
  .action(() => {
    console.log('\n📖 GIT PROGRESS REPORTING EXAMPLES');
    console.log('='.repeat(50));
    console.log('');
    console.log('📊 Analyze recent development:');
    console.log('  npx tsx gitprogress.ts analyze --since "2 weeks ago"');
    console.log('');
    console.log('📤 Send cumulative progress report:');
    console.log('  npx tsx gitprogress.ts report --since "1 month ago"');
    console.log('');
    console.log('👀 Preview report without sending:');
    console.log('  npx tsx gitprogress.ts report --preview');
    console.log('');
    console.log('🚀 Quick update for recent work:');
    console.log('  npx tsx gitprogress.ts quick --days 3');
    console.log('');
    console.log('📋 List categorized commits:');
    console.log('  npx tsx gitprogress.ts commits --number 10');
    console.log('');
    console.log('📊 Check repository status:');
    console.log('  npx tsx gitprogress.ts status');
    console.log('');
    console.log('='.repeat(50));
  });

// Parse command line arguments
program.parse();