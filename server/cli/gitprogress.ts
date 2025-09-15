#!/usr/bin/env node

import { Command } from 'commander';
import { GitIntegratedProgressService } from '../services/gitIntegratedProgress.js';
import { SavingsCalculator } from '../services/estimation/savingsCalculator.js';
import { AnalyzeOptionsSchema, ReportOptionsSchema, sanitizeGitSinceDate, sanitizeConfidenceThreshold } from '../../shared/gitValidation.js';
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
  console.log(`${colors.bold}💵 Total Savings:${colors.reset} ${colors.green}${formatCurrency(calculation?.savings?.dollars || 0)}${colors.reset}`);
  console.log(`${colors.bold}⏰ Time Saved:${colors.reset} ${colors.cyan}${Math.round(calculation?.savings?.hours || 0)} hours (${Math.round(calculation?.savings?.weeks || 0)} weeks)${colors.reset}`);
  console.log(`${colors.bold}📊 Cost Reduction:${colors.reset} ${colors.yellow}${Math.round(calculation?.savings?.percentage || 0)}%${colors.reset}`);
  console.log(`${colors.bold}🚀 Productivity Gain:${colors.reset} ${colors.magenta}${summary?.efficiency?.productivityMultiplier || 1}x${colors.reset} vs traditional`);
  console.log(`${colors.bold}📈 ROI:${colors.reset} ${colors.green}${summary?.totalSavings?.roi || 1}x${colors.reset}`);
  console.log(`${colors.bold}🎯 Confidence:${colors.reset} ${confidence >= 70 ? colors.green : confidence >= 50 ? colors.yellow : colors.red}${Math.round(confidence || 0)}%${colors.reset}`);
  
  if (showDetails && summary.topOpportunities.length > 0) {
    console.log(`\n${colors.bold}🏆 TOP SAVINGS OPPORTUNITIES:${colors.reset}`);
    summary.topOpportunities.slice(0, 3).forEach((opportunity: any, index: number) => {
      console.log(`  ${index + 1}. ${colors.cyan}${opportunity.name}${colors.reset}: ${colors.green}${formatCurrency(opportunity.savings)}${colors.reset} saved`);
      if (opportunity.recommendation) {
        console.log(`     💡 ${opportunity.recommendation}`);
      }
    });
  }
  
  if (showDetails && savings.topFeatures.length > 0) {
    console.log(`\n${colors.bold}⚡ MOST EFFICIENT FEATURES:${colors.reset}`);
    savings.topFeatures.slice(0, 3).forEach((feature: any, index: number) => {
      console.log(`  ${index + 1}. ${colors.blue}${feature.cluster.name}${colors.reset}: ${colors.green}${formatCurrency(feature.savings.savings.dollars)}${colors.reset} (${feature.efficiency.velocityScore.toFixed(2)} velocity score)`);
    });
  }
  
  console.log(`${colors.green}${'='.repeat(50)}${colors.reset}`);
};

program
  .name('gitprogress')
  .description('Git-integrated development progress reporting with comprehensive savings analysis')
  .version('2.0.0');

// Analyze git history command
program
  .command('analyze')
  .description('Analyze git history and display development categories with savings analysis')
  .option('-s, --since <period>', 'Time period to analyze (e.g., "1 month ago", "2 weeks ago")', '1 month ago')
  .option('-j, --json', 'Output results in JSON format')
  .option('--no-savings', 'Disable savings calculation')
  .option('--confidence-threshold <number>', 'Minimum confidence threshold for savings reporting', '50')
  .option('--savings-only', 'Show only savings analysis')
  .action(async (rawOptions) => {
    try {
      // Validate and sanitize all CLI options to prevent injection attacks
      const options = AnalyzeOptionsSchema.parse(rawOptions);
      
      console.log(`🔍 Analyzing git history since: ${options.since}`);
      const analysisConfig = {
        sinceDate: options.since,
        enableSavings: options.savings !== false,
        confidenceThreshold: options.confidenceThreshold
      };
      
      const analysis = await gitProgressService.analyzeGitHistory(analysisConfig);
      
      if (options.json) {
        console.log(JSON.stringify(analysis, null, 2));
      } else if (options.savingsOnly) {
        // Show only savings analysis
        if (analysis.savings) {
          displaySavingsSummary(analysis.savings, true);
        } else {
          console.log(`${colors.yellow}⚠️  No savings data available for this period${colors.reset}`);
        }
      } else {
        // Display formatted analysis with savings integration
        console.log('\n' + '='.repeat(80));
        console.log(`${colors.bold}📊 COMPREHENSIVE GIT HISTORY ANALYSIS${colors.reset}`);
        console.log('='.repeat(80));
        console.log(`📅 Period: ${colors.cyan}${analysis.dateRange}${colors.reset}`);
        console.log(`📈 Total Commits: ${colors.yellow}${analysis.totalCommits}${colors.reset}`);
        console.log(`📁 Files Changed: ${colors.blue}${analysis.fileStats.filesChanged}${colors.reset}`);
        console.log(`➕ Lines Added: ${colors.green}${analysis.fileStats.additions}${colors.reset}`);
        console.log(`➖ Lines Removed: ${colors.red}${analysis.fileStats.deletions}${colors.reset}`);
        
        // Show savings summary first if available
        if (analysis.savings && analysis.savings.confidence >= options.confidenceThreshold) {
          displaySavingsSummary(analysis.savings, false);
        }
        
        console.log(`\n${colors.bold}🏗️ DEVELOPMENT CATEGORIES:${colors.reset}`);
        analysis.categories.forEach(category => {
          const savingsInfo = analysis.savings?.topFeatures?.find(f => f.cluster.name === category.name);
          const savingsText = savingsInfo ? ` ${colors.green}(${formatCurrency(savingsInfo.savings.savings.dollars)} saved)${colors.reset}` : '';
          console.log(`  • ${colors.blue}${category.name}${colors.reset}: ${colors.yellow}${category.commits.length}${colors.reset} commits${savingsText}`);
        });
        
        console.log(`\n${colors.bold}👥 TOP CONTRIBUTORS:${colors.reset}`);
        analysis.topContributors.forEach((contributor, index) => {
          console.log(`  ${index + 1}. ${colors.cyan}${contributor.author}${colors.reset}: ${colors.yellow}${contributor.commits}${colors.reset} commits`);
        });
        
        if (analysis.savings && analysis.savings.confidence < options.confidenceThreshold) {
          console.log(`\n${colors.yellow}⚠️  Savings analysis available but below confidence threshold (${Math.round(analysis.savings.confidence)}% < ${options.confidenceThreshold}%)${colors.reset}`);
          console.log(`${colors.yellow}   Use --confidence-threshold ${Math.round(analysis.savings.confidence)} to display savings data${colors.reset}`);
        }
        
        console.log('='.repeat(80));
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Invalid')) {
        console.error(`❌ Security validation failed: ${error.message}`);
        console.error('💡 Use --help to see valid options and formats');
      } else {
        console.error('❌ Error analyzing git history:', error);
      }
      process.exit(1);
    }
  });

// Generate cumulative report command
program
  .command('report')
  .description('Generate comprehensive progress report with savings analysis')
  .option('-s, --since <period>', 'Time period to analyze', '1 month ago')
  .option('--no-send', 'Generate report but do not send to Dart AI')
  .option('-p, --preview', 'Preview report without sending')
  .option('--no-savings', 'Disable savings calculation')
  .option('--confidence-threshold <number>', 'Minimum confidence threshold for savings reporting', '50')
  .action(async (rawOptions) => {
    try {
      // Validate and sanitize all CLI options to prevent injection attacks
      const options = ReportOptionsSchema.parse(rawOptions);
      
      const sendToDart = options.send && !options.preview;
      
      if (options.preview) {
        console.log('👀 Generating preview of comprehensive progress report with savings analysis...');
      } else if (sendToDart) {
        console.log('📤 Generating and sending comprehensive progress report with savings analysis...');
      } else {
        console.log('💾 Generating comprehensive progress report with savings analysis (not sending)...');
      }
      
      const reportConfig = {
        sinceDate: options.since,
        sendToDart,
        enableSavings: options.savings !== false,
        confidenceThreshold: options.confidenceThreshold
      };
      
      await gitProgressService.generateCumulativeReport(reportConfig);
      
      if (options.preview) {
        console.log('\n✅ Preview complete! Use --no-preview to send the report.');
      } else if (sendToDart) {
        console.log('\n✅ Comprehensive progress report with savings analysis sent to Dart AI successfully!');
      } else {
        console.log('\n✅ Comprehensive report with savings analysis generated successfully!');
      }
      
    } catch (error) {
      if (error instanceof Error && error.message.includes('Invalid')) {
        console.error(`❌ Security validation failed: ${error.message}`);
        console.error('💡 Use --help to see valid options and formats');
      } else {
        console.error('❌ Error generating report:', error);
      }
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
  .description('Quick progress update with savings insights for recent changes')
  .option('-d, --days <number>', 'Number of days to include in report', '7')
  .option('-m, --message <text>', 'Custom summary message')
  .option('--no-savings', 'Disable savings calculation')
  .option('--confidence-threshold <number>', 'Minimum confidence threshold for savings reporting', '50')
  .action(async (options) => {
    try {
      const sinceDate = `${options.days} days ago`;
      const analysisConfig = {
        sinceDate,
        enableSavings: options.savings !== false,
        confidenceThreshold: options.confidenceThreshold
      };
      
      const analysis = await gitProgressService.analyzeGitHistory(analysisConfig);
      
      if (analysis.totalCommits === 0) {
        console.log('📭 No commits found in the specified period.');
        return;
      }
      
      console.log(`🚀 Generating quick progress update for last ${options.days} days...`);
      
      // Show quick savings summary if available
      if (analysis.savings && analysis.savings.confidence >= options.confidenceThreshold) {
        console.log(`\n${colors.green}${colors.bold}⚡ QUICK SAVINGS SNAPSHOT:${colors.reset}`);
        console.log(`💵 Recent Savings: ${colors.green}${formatCurrency(analysis.savings.calculation.savings.dollars)}${colors.reset}`);
        console.log(`⏰ Time Saved: ${colors.cyan}${Math.round(analysis.savings.calculation.savings.hours)} hours${colors.reset}`);
        console.log(`🚀 Productivity: ${colors.magenta}${analysis.savings.summary.efficiency.productivityMultiplier}x${colors.reset} vs traditional`);
      }
      
      let summary = options.message;
      if (!summary) {
        summary = `Development progress update: ${analysis.totalCommits} commits over ${options.days} days across ${analysis.categories.length} feature areas`;
        
        // Enhance summary with savings data if available
        if (analysis.savings?.calculationSucceeded && analysis.savings.confidence >= 70) {
          const dollarsSaved = Math.round(analysis.savings.calculation.savings.dollars);
          const weeksSaved = Math.round(analysis.savings.calculation.savings.weeks);
          if (dollarsSaved > 500) {
            summary += ` - ${formatCurrency(dollarsSaved)} saved with ${weeksSaved} weeks ahead of schedule`;
          }
        }
      }
      
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
      
      console.log('\n✅ Quick progress update with savings insights sent successfully!');
      
    } catch (error) {
      console.error('❌ Error sending quick update:', error);
      process.exit(1);
    }
  });

// List recent commits command
program
  .command('commits')
  .description('List recent commits with categories and savings context')
  .option('-n, --number <count>', 'Number of commits to show', '20')
  .option('-s, --since <period>', 'Time period to show', '1 week ago')
  .option('--no-savings', 'Disable savings calculation')
  .option('--confidence-threshold <number>', 'Minimum confidence threshold for savings reporting', '50')
  .action(async (options) => {
    try {
      const analysisConfig = {
        sinceDate: options.since,
        enableSavings: options.savings !== false,
        confidenceThreshold: options.confidenceThreshold
      };
      
      const analysis = await gitProgressService.analyzeGitHistory(analysisConfig);
      
      console.log(`\n${colors.bold}📋 RECENT COMMITS BY CATEGORY WITH SAVINGS CONTEXT${colors.reset}`);
      console.log('='.repeat(80));
      
      // Create savings context map for categories
      const categorySavingsMap = new Map();
      if (analysis.savings?.topFeatures) {
        analysis.savings.topFeatures.forEach(feature => {
          categorySavingsMap.set(feature.cluster.name, {
            savings: feature.savings.savings.dollars,
            efficiency: feature.efficiency.velocityScore
          });
        });
      }
      
      analysis.categories.forEach(category => {
        if (category.commits.length === 0) return;
        
        const categorySavings = categorySavingsMap.get(category.name);
        let categoryHeader = `\n🏷️  ${colors.blue}${category.name}${colors.reset} (${colors.yellow}${category.commits.length}${colors.reset} commits)`;
        
        if (categorySavings) {
          categoryHeader += ` ${colors.green}[${formatCurrency(categorySavings.savings)} saved]${colors.reset}`;
          if (categorySavings.efficiency > 0.8) {
            categoryHeader += ` ${colors.magenta}🚀 High Efficiency${colors.reset}`;
          }
        }
        
        console.log(categoryHeader + ':');
        
        category.commits.slice(0, parseInt(options.number)).forEach(commit => {
          console.log(`   ${colors.cyan}${commit.hash}${colors.reset} - ${colors.yellow}${commit.date}${colors.reset} - ${commit.message}`);
        });
      });
      
      // Show savings summary at the end
      if (analysis.savings && analysis.savings.confidence >= options.confidenceThreshold) {
        console.log('\n' + '='.repeat(80));
        displaySavingsSummary(analysis.savings, false);
      }
      
      console.log('='.repeat(80));
      
    } catch (error) {
      console.error('❌ Error listing commits:', error);
      process.exit(1);
    }
  });

// New calibrate command for adjusting estimates
program
  .command('calibrate')
  .description('Calibrate estimates based on actual project data')
  .option('-s, --since <period>', 'Time period to calibrate on', '1 month ago')
  .option('--actual-hours <hours>', 'Actual hours spent for calibration period (for validation)')
  .option('--category <category>', 'Specific category to calibrate')
  .option('--show-before-after', 'Show accuracy improvements from calibration')
  .option('--dry-run', 'Preview calibration without saving')
  .action(async (options) => {
    try {
      console.log(`🔧 Calibrating development estimates based on period: ${options.since}`);
      
      // Initialize savings calculator
      await savingsCalculator.initialize();
      
      const calibrationConfig = {
        sinceDate: options.since,
        category: options.category,
        actualHours: options.actualHours ? parseFloat(options.actualHours) : undefined,
        showBeforeAfter: options.showBeforeAfter,
        dryRun: options.dryRun
      };
      
      // Perform calibration using SavingsCalculator API
      const calibrationResult = await savingsCalculator.performCalibration(calibrationConfig);
      
      console.log(`\n${colors.bold}🔧 CALIBRATION RESULTS${colors.reset}`);
      console.log('='.repeat(60));
      
      if (options.showBeforeAfter) {
        console.log(`\n${colors.bold}📊 ACCURACY IMPROVEMENTS:${colors.reset}`);
        calibrationResult.improvements.forEach((improvement: any) => {
          console.log(`  • ${colors.blue}${improvement.category}${colors.reset}:`);
          console.log(`    Before: ${colors.red}${improvement.before.averageError}% error${colors.reset}`);
          console.log(`    After:  ${colors.green}${improvement.after.averageError}% error${colors.reset}`);
          console.log(`    Improvement: ${colors.green}${improvement.improvement}%${colors.reset}`);
        });
      }
      
      console.log(`\n${colors.bold}🎯 CALIBRATION FACTORS:${colors.reset}`);
      Object.entries(calibrationResult.factors).forEach(([category, factor]: [string, any]) => {
        console.log(`  • ${colors.cyan}${category}${colors.reset}: ${colors.yellow}${factor}x${colors.reset} multiplier`);
      });
      
      if (options.dryRun) {
        console.log(`\n${colors.yellow}💡 Dry run mode - calibration factors not saved${colors.reset}`);
        console.log(`${colors.yellow}   Remove --dry-run to apply these calibrations${colors.reset}`);
      } else {
        console.log(`\n${colors.green}✅ Calibration factors saved successfully!${colors.reset}`);
        console.log(`${colors.green}   Future estimates will use these improved factors${colors.reset}`);
      }
      
      console.log('='.repeat(60));
      
    } catch (error) {
      console.error('❌ Error performing calibration:', error);
      process.exit(1);
    }
  });

// New dedicated savings command
program
  .command('savings')
  .description('Comprehensive savings analysis and reporting')
  .option('-s, --since <period>', 'Time period to analyze', '1 month ago')
  .option('--until <period>', 'End date for analysis (default: now)')
  .option('--confidence-threshold <number>', 'Minimum confidence threshold', '50')
  .option('--category <category>', 'Focus on specific category')
  .option('--trend-analysis', 'Include trend analysis over time')
  .option('--recommendations', 'Include optimization recommendations')
  .option('--export <format>', 'Export results (json, csv)')
  .action(async (options) => {
    try {
      console.log(`💰 Performing comprehensive savings analysis for period: ${options.since}`);
      
      // Initialize savings calculator
      await savingsCalculator.initialize();
      
      const savingsConfig = {
        sinceDate: options.since,
        untilDate: options.until,
        minConfidence: options.confidenceThreshold,
        category: options.category,
        reporting: {
          includeDetailedBreakdowns: true,
          includeTrendAnalysis: options.trendAnalysis,
          includeClusterAnalysis: true,
          includeCalibrationRecommendations: options.recommendations
        }
      };
      
      const comprehensiveResult = await savingsCalculator.calculateProjectSavings(savingsConfig);
      
      console.log(`\n${colors.bold}${colors.green}💰 COMPREHENSIVE SAVINGS ANALYSIS${colors.reset}`);
      console.log(`${colors.green}${'='.repeat(80)}${colors.reset}`);
      
      // Executive Summary
      console.log(`\n${colors.bold}📋 EXECUTIVE SUMMARY:${colors.reset}`);
      console.log(`💵 Total Savings: ${colors.green}${formatCurrency(comprehensiveResult.summary.totalSavings.dollars)}${colors.reset}`);
      console.log(`⏰ Time Saved: ${colors.cyan}${comprehensiveResult.summary.totalSavings.hours} hours (${comprehensiveResult.summary.totalSavings.weeks} weeks)${colors.reset}`);
      console.log(`📊 Cost Reduction: ${colors.yellow}${comprehensiveResult.summary.totalSavings.percentage}%${colors.reset}`);
      console.log(`🚀 Productivity Multiplier: ${colors.magenta}${comprehensiveResult.summary.efficiency.productivityMultiplier}x${colors.reset}`);
      console.log(`📈 ROI: ${colors.green}${comprehensiveResult.summary.totalSavings.roi}x${colors.reset}`);
      
      // Category Breakdown
      console.log(`\n${colors.bold}📊 SAVINGS BY CATEGORY:${colors.reset}`);
      Object.entries(comprehensiveResult.categoryAnalysis).forEach(([category, analysis]: [string, any]) => {
        if (analysis.savings.dollars > 0) {
          console.log(`  • ${colors.blue}${category}${colors.reset}: ${colors.green}${formatCurrency(analysis.savings.dollars)}${colors.reset} (${analysis.savings.percentage}%)`);
        }
      });
      
      // Top Opportunities
      if (comprehensiveResult.summary.topOpportunities.length > 0) {
        console.log(`\n${colors.bold}🏆 TOP SAVINGS OPPORTUNITIES:${colors.reset}`);
        comprehensiveResult.summary.topOpportunities.slice(0, 5).forEach((opportunity: any, index: number) => {
          console.log(`  ${index + 1}. ${colors.cyan}${opportunity.name}${colors.reset}: ${colors.green}${formatCurrency(opportunity.savings)}${colors.reset}`);
          console.log(`     ${colors.yellow}💡 ${opportunity.recommendation}${colors.reset}`);
        });
      }
      
      // Feature Cluster Analysis
      if (comprehensiveResult.clusterAnalysis.length > 0) {
        console.log(`\n${colors.bold}⚡ MOST EFFICIENT FEATURE CLUSTERS:${colors.reset}`);
        comprehensiveResult.clusterAnalysis.slice(0, 5).forEach((cluster: any, index: number) => {
          console.log(`  ${index + 1}. ${colors.blue}${cluster.cluster.name}${colors.reset}:`);
          console.log(`     Savings: ${colors.green}${formatCurrency(cluster.savings.savings.dollars)}${colors.reset}`);
          console.log(`     Efficiency: ${colors.magenta}${cluster.efficiency.velocityScore.toFixed(2)}${colors.reset} velocity score`);
          console.log(`     Hours/Commit: ${colors.cyan}${cluster.efficiency.hoursPerCommit.toFixed(1)}${colors.reset}`);
        });
      }
      
      // Trend Analysis
      if (options.trendAnalysis && comprehensiveResult.trendAnalysis.length > 0) {
        console.log(`\n${colors.bold}📈 TREND ANALYSIS:${colors.reset}`);
        comprehensiveResult.trendAnalysis.forEach((trend: any) => {
          const trendEmoji = trend.trend.direction === 'improving' ? '📈' : trend.trend.direction === 'declining' ? '📉' : '➡️';
          console.log(`  ${trendEmoji} ${colors.cyan}${trend.period}${colors.reset}: ${colors.green}${formatCurrency(trend.savings.savings.dollars)}${colors.reset} (${trend.trend.direction})`);
        });
      }
      
      // Recommendations
      if (options.recommendations && comprehensiveResult.recommendations.length > 0) {
        console.log(`\n${colors.bold}💡 OPTIMIZATION RECOMMENDATIONS:${colors.reset}`);
        comprehensiveResult.recommendations.filter((rec: any) => rec.priority === 'high' || rec.priority === 'critical').forEach((rec: any, index: number) => {
          const priorityColor = rec.priority === 'critical' ? colors.red : rec.priority === 'high' ? colors.yellow : colors.blue;
          console.log(`  ${index + 1}. ${priorityColor}[${rec.priority.toUpperCase()}]${colors.reset} ${rec.description}`);
          console.log(`     Expected Impact: ${colors.green}${formatCurrency(rec.expectedImpact.savings)}${colors.reset} additional savings`);
        });
      }
      
      // Confidence and Risk Assessment
      console.log(`\n${colors.bold}🎯 CONFIDENCE & RISK ASSESSMENT:${colors.reset}`);
      console.log(`Overall Confidence: ${comprehensiveResult.confidence.overall >= 70 ? colors.green : comprehensiveResult.confidence.overall >= 50 ? colors.yellow : colors.red}${comprehensiveResult.confidence.overall}%${colors.reset}`);
      if (comprehensiveResult.confidence.risks.length > 0) {
        console.log(`Key Risks:`);
        comprehensiveResult.confidence.risks.forEach((risk: any) => {
          const riskColor = risk.impact === 'high' ? colors.red : risk.impact === 'medium' ? colors.yellow : colors.blue;
          console.log(`  • ${riskColor}${risk.description}${colors.reset}`);
        });
      }
      
      // Export if requested
      if (options.export) {
        const exportPath = `savings-analysis-${new Date().toISOString().slice(0, 10)}.${options.export}`;
        if (options.export === 'json') {
          const fs = await import('fs/promises');
          await fs.writeFile(exportPath, JSON.stringify(comprehensiveResult, null, 2));
        }
        console.log(`\n${colors.green}📁 Results exported to ${exportPath}${colors.reset}`);
      }
      
      console.log(`${colors.green}${'='.repeat(80)}${colors.reset}`);
      
    } catch (error) {
      console.error('❌ Error performing savings analysis:', error);
      process.exit(1);
    }
  });

// Enhanced help command
program
  .command('help-examples')
  .description('Show comprehensive usage examples')
  .action(() => {
    console.log(`\n${colors.bold}📖 COMPREHENSIVE GIT PROGRESS & SAVINGS REPORTING EXAMPLES${colors.reset}`);
    console.log('='.repeat(80));
    console.log('');
    
    console.log(`${colors.bold}📊 ANALYSIS COMMANDS:${colors.reset}`);
    console.log(`  ${colors.cyan}Basic analysis:${colors.reset}`);
    console.log('    npx tsx gitprogress.ts analyze --since "2 weeks ago"');
    console.log(`  ${colors.cyan}Analysis with savings:${colors.reset}`);
    console.log('    npx tsx gitprogress.ts analyze --since "1 month ago" --confidence-threshold 60');
    console.log(`  ${colors.cyan}Savings-only view:${colors.reset}`);
    console.log('    npx tsx gitprogress.ts analyze --savings-only --since "3 months ago"');
    console.log('');
    
    console.log(`${colors.bold}📤 REPORTING COMMANDS:${colors.reset}`);
    console.log(`  ${colors.cyan}Full report with savings:${colors.reset}`);
    console.log('    npx tsx gitprogress.ts report --since "1 month ago"');
    console.log(`  ${colors.cyan}Preview mode:${colors.reset}`);
    console.log('    npx tsx gitprogress.ts report --preview --confidence-threshold 70');
    console.log(`  ${colors.cyan}Skip savings (faster):${colors.reset}`);
    console.log('    npx tsx gitprogress.ts report --no-savings');
    console.log('');
    
    console.log(`${colors.bold}💰 SAVINGS ANALYSIS COMMANDS:${colors.reset}`);
    console.log(`  ${colors.cyan}Comprehensive savings analysis:${colors.reset}`);
    console.log('    npx tsx gitprogress.ts savings --since "3 months ago"');
    console.log(`  ${colors.cyan}Trend analysis with recommendations:${colors.reset}`);
    console.log('    npx tsx gitprogress.ts savings --trend-analysis --recommendations');
    console.log(`  ${colors.cyan}Category-specific analysis:${colors.reset}`);
    console.log('    npx tsx gitprogress.ts savings --category "UI" --export json');
    console.log('');
    
    console.log(`${colors.bold}🔧 CALIBRATION COMMANDS:${colors.reset}`);
    console.log(`  ${colors.cyan}Basic calibration:${colors.reset}`);
    console.log('    npx tsx gitprogress.ts calibrate --since "1 month ago"');
    console.log(`  ${colors.cyan}Validation with actual hours:${colors.reset}`);
    console.log('    npx tsx gitprogress.ts calibrate --actual-hours 320 --show-before-after');
    console.log(`  ${colors.cyan}Category-specific calibration:${colors.reset}`);
    console.log('    npx tsx gitprogress.ts calibrate --category "Backend" --dry-run');
    console.log('');
    
    console.log(`${colors.bold}🚀 QUICK UPDATES:${colors.reset}`);
    console.log(`  ${colors.cyan}Recent work with savings:${colors.reset}`);
    console.log('    npx tsx gitprogress.ts quick --days 3');
    console.log(`  ${colors.cyan}Custom message:${colors.reset}`);
    console.log('    npx tsx gitprogress.ts quick --days 7 --message "Sprint 2 completion"');
    console.log('');
    
    console.log(`${colors.bold}📋 COMMIT ANALYSIS:${colors.reset}`);
    console.log(`  ${colors.cyan}Recent commits with savings context:${colors.reset}`);
    console.log('    npx tsx gitprogress.ts commits --number 15 --since "1 week ago"');
    console.log(`  ${colors.cyan}High-confidence savings only:${colors.reset}`);
    console.log('    npx tsx gitprogress.ts commits --confidence-threshold 80');
    console.log('');
    
    console.log(`${colors.bold}🔧 UTILITY COMMANDS:${colors.reset}`);
    console.log(`  ${colors.cyan}Repository status:${colors.reset}`);
    console.log('    npx tsx gitprogress.ts status');
    console.log(`  ${colors.cyan}This help:${colors.reset}`);
    console.log('    npx tsx gitprogress.ts help-examples');
    console.log('');
    
    console.log(`${colors.bold}💡 COMMON OPTIONS:${colors.reset}`);
    console.log(`  ${colors.yellow}--no-savings${colors.reset}               Disable savings calculations (faster)`);
    console.log(`  ${colors.yellow}--confidence-threshold N${colors.reset}   Only show savings with N% confidence or higher`);
    console.log(`  ${colors.yellow}--since "period"${colors.reset}            Time period (e.g., "2 weeks ago", "1 month ago")`);
    console.log(`  ${colors.yellow}--json${colors.reset}                     Output in JSON format`);
    console.log(`  ${colors.yellow}--export format${colors.reset}            Export results (json, csv)`);
    console.log('');
    console.log('='.repeat(80));
  });

// Parse command line arguments
program.parse();