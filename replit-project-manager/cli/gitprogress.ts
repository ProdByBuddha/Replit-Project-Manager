#!/usr/bin/env node

import { Command } from 'commander';
import { GitIntegratedProgressService } from '../src/git/gitIntegration.js';
import { SavingsCalculator } from '../src/estimation/savingsCalculator.js';
import { AnalyzeOptionsSchema, ReportOptionsSchema, sanitizeGitSinceDate, sanitizeConfidenceThreshold } from '../src/validation.js';
import 'dotenv/config';

const program = new Command();
const gitProgressService = GitIntegratedProgressService.getInstance();
const savingsCalculator = SavingsCalculator.getInstance();

// Color codes for enhanced output
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  bold: '\x1b[1m',
  reset: '\x1b[0m'
};

// Helper function to format currency
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

// Helper function to display savings summary
const displaySavingsSummary = (savings: any, showDetails: boolean = true): void => {
  if (!savings?.calculationSucceeded) {
    if (savings?.errorMessage) {
      console.log(`${colors.yellow}⚠️  Savings calculation failed: ${savings.errorMessage}${colors.reset}`);
    }
    return;
  }

  const { calculation, summary, confidence } = savings;
  
  console.log(`\n${colors.green}${colors.bold}💰 DEVELOPMENT SAVINGS ANALYSIS${colors.reset}`);
  console.log(`${colors.green}${'='.repeat(50)}${colors.reset}`);
  
  // Main savings metrics
  if (calculation?.savings?.dollars) {
    console.log(`${colors.bold}💵 Total Savings:${colors.reset} ${colors.green}${formatCurrency(calculation.savings.dollars)}${colors.reset}`);
    console.log(`${colors.bold}⏰ Time Saved:${colors.reset} ${colors.cyan}${Math.round(calculation.savings.hours)} hours (${Math.round(calculation.savings.weeks)} weeks)${colors.reset}`);
    console.log(`${colors.bold}📊 Cost Reduction:${colors.reset} ${colors.yellow}${Math.round(calculation.savings.percentage)}%${colors.reset}`);
    console.log(`${colors.bold}🚀 Productivity Gain:${colors.reset} ${colors.magenta}${summary?.efficiency?.productivityMultiplier?.toFixed(1) || 'N/A'}x${colors.reset} vs traditional`);
    console.log(`${colors.bold}📈 ROI:${colors.reset} ${colors.green}${summary?.totalSavings?.roi?.toFixed(1) || 'N/A'}x${colors.reset}`);
  }
  console.log(`${colors.bold}🎯 Confidence:${colors.reset} ${confidence >= 70 ? colors.green : confidence >= 50 ? colors.yellow : colors.red}${Math.round(confidence)}%${colors.reset}`);
  
  if (showDetails && summary?.topValueAreas?.length > 0) {
    console.log(`\n${colors.bold}🎯 Top Value Areas:${colors.reset}`);
    summary.topValueAreas.slice(0, 3).forEach((area: any) => {
      console.log(`  • ${area.category}: ${formatCurrency(area.savingsAmount)}`);
    });
  }
  
  console.log(`${colors.green}${'='.repeat(50)}${colors.reset}`);
};

program
  .name('rpm-gitprogress')
  .description('Git-integrated development progress reporting for Dart AI')
  .version('1.0.0');

// Analyze git history command
program
  .command('analyze')
  .description('Analyze git history and display development categories')
  .option('-s, --since <period>', 'Time period to analyze (e.g., "1 month ago", "2 weeks ago")', '1 month ago')
  .option('-j, --json', 'Output results in JSON format')
  .option('--confidence-threshold <number>', 'Minimum confidence threshold for savings', '70')
  .option('--no-savings', 'Disable savings calculation')
  .action(async (options) => {
    try {
      console.log(`🔍 Analyzing git history since: ${options.since}`);
      const analysis = await gitProgressService.analyzeGitHistory(options.since, {
        enableSavings: options.savings !== false,
        confidenceThreshold: sanitizeConfidenceThreshold(options.confidenceThreshold)
      });
      
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
          let line = `  ${index + 1}. ${contributor.author}: ${contributor.commits} commits`;
          if (contributor.timeWorked) {
            line += ` | ${Math.round(contributor.timeWorked / 60)}h worked`;
          }
          if (contributor.agentUsage) {
            line += ` | $${contributor.agentUsage.toFixed(2)} agent cost`;
          }
          console.log(line);
        });
        
        // Display agent metrics if available
        if (analysis.agentMetrics) {
          console.log('\n🤖 REPLIT AGENT METRICS:');
          const { total, perCommit, trend } = analysis.agentMetrics;
          console.log(`  Total Time Worked: ${Math.round((total.timeWorked || 0) / 60)} hours`);
          console.log(`  Total Work Done: ${(total.workDone || 0).toLocaleString()} actions`);
          console.log(`  Total Items Read: ${(total.itemsRead || 0).toLocaleString()} lines`);
          console.log(`  Total Code Changed: +${total.codeAdded || 0}/-${total.codeDeleted || 0} lines`);
          console.log(`  Total Agent Usage: $${(total.agentUsage || 0).toFixed(2)}`);
          
          console.log('\n  📈 Per-Commit Averages:');
          console.log(`    Time: ${perCommit.timeWorked} minutes`);
          console.log(`    Actions: ${perCommit.workDone}`);
          console.log(`    Cost: $${(perCommit.agentUsage || 0).toFixed(2)}`);
          
          console.log('\n  📊 Productivity Trends:');
          console.log(`    Time Efficiency: ${trend.timeEfficiency > 0 ? '✅' : '⚠️'} ${Math.abs(trend.timeEfficiency)}% ${trend.timeEfficiency > 0 ? 'improved' : 'slower'}`);
          console.log(`    Cost Efficiency: ${trend.costEfficiency > 0 ? '✅' : '⚠️'} ${Math.abs(trend.costEfficiency)}% ${trend.costEfficiency > 0 ? 'cheaper' : 'more expensive'}`);
          console.log(`    Overall Score: ${trend.productivityScore}/100`);
        }
        
        // Display savings if available
        if (analysis.savings) {
          displaySavingsSummary(analysis.savings);
        }
        
        console.log('='.repeat(60));
      }
    } catch (error) {
      console.error('❌ Error analyzing git history:', error);
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

// Help command
program
  .command('help-examples')
  .description('Show usage examples')
  .action(() => {
    console.log('\n📖 GIT PROGRESS REPORTING EXAMPLES');
    console.log('='.repeat(50));
    console.log('');
    console.log('📊 Analyze recent development:');
    console.log('  rpm-gitprogress analyze --since "2 weeks ago"');
    console.log('');
    console.log('📊 Analyze without savings calculation:');
    console.log('  rpm-gitprogress analyze --no-savings');
    console.log('');
    console.log('📋 Get JSON output:');
    console.log('  rpm-gitprogress analyze --json');
    console.log('');
    console.log('📊 Check repository status:');
    console.log('  rpm-gitprogress status');
    console.log('');
    console.log('='.repeat(50));
  });

// Parse command line arguments
program.parse();