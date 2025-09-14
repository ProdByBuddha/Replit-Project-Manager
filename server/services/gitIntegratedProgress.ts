import { exec } from 'child_process';
import { promisify } from 'util';
import { DevProgressService } from './devProgress.js';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

interface GitCommit {
  hash: string;
  author: string;
  date: string;
  message: string;
}

interface CommitCategory {
  name: string;
  commits: GitCommit[];
  keywords: string[];
}

interface GitAnalysisResult {
  totalCommits: number;
  dateRange: string;
  categories: CommitCategory[];
  topContributors: { author: string; commits: number }[];
  fileStats: { additions: number; deletions: number; filesChanged: number };
}

export class GitIntegratedProgressService {
  private static instance: GitIntegratedProgressService;
  private devProgressService: DevProgressService;

  private constructor() {
    this.devProgressService = DevProgressService.getInstance();
  }

  public static getInstance(): GitIntegratedProgressService {
    if (!GitIntegratedProgressService.instance) {
      GitIntegratedProgressService.instance = new GitIntegratedProgressService();
    }
    return GitIntegratedProgressService.instance;
  }

  /**
   * Analyze git history and categorize commits by functionality
   */
  public async analyzeGitHistory(sinceDate: string = '1 month ago'): Promise<GitAnalysisResult> {
    try {
      console.log('[GitProgress] Analyzing git history...');
      
      // Get commit history
      const { stdout: commitData } = await execAsync(
        `git log --pretty=format:"%h|%an|%ad|%s" --date=short --since="${sinceDate}"`
      );
      
      // Parse commits
      const commits: GitCommit[] = commitData
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [hash, author, date, message] = line.split('|');
          return { hash, author, date, message };
        });

      // Get file statistics
      const fileStats = await this.getFileStatistics(sinceDate);

      // Categorize commits
      const categories = await this.categorizeCommits(commits);

      // Calculate top contributors
      const contributorMap = new Map<string, number>();
      commits.forEach(commit => {
        contributorMap.set(commit.author, (contributorMap.get(commit.author) || 0) + 1);
      });
      
      const topContributors = Array.from(contributorMap.entries())
        .map(([author, commits]) => ({ author, commits }))
        .sort((a, b) => b.commits - a.commits)
        .slice(0, 5);

      // Calculate date range
      const dates = commits.map(c => c.date).filter(Boolean);
      const dateRange = dates.length > 0 
        ? `${dates[dates.length - 1]} to ${dates[0]}`
        : 'No commits found';

      return {
        totalCommits: commits.length,
        dateRange,
        categories,
        topContributors,
        fileStats
      };

    } catch (error) {
      console.error('[GitProgress] Error analyzing git history:', error);
      throw error;
    }
  }

  /**
   * Get file change statistics from git
   */
  private async getFileStatistics(sinceDate: string): Promise<{ additions: number; deletions: number; filesChanged: number }> {
    try {
      const { stdout: diffStat } = await execAsync(
        `git diff --shortstat HEAD~100..HEAD 2>/dev/null || echo "0 files changed, 0 insertions(+), 0 deletions(-)"`
      );
      
      // Parse diff statistics
      const match = diffStat.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);
      
      return {
        filesChanged: match ? parseInt(match[1]) || 0 : 0,
        additions: match ? parseInt(match[2]) || 0 : 0,
        deletions: match ? parseInt(match[3]) || 0 : 0
      };
    } catch (error) {
      console.warn('[GitProgress] Could not get file statistics:', error);
      return { additions: 0, deletions: 0, filesChanged: 0 };
    }
  }

  /**
   * Categorize commits by functionality based on commit messages
   */
  private async categorizeCommits(commits: GitCommit[]): Promise<CommitCategory[]> {
    const categories: CommitCategory[] = [
      {
        name: 'Dart AI Integration & Project Management',
        keywords: ['dart', 'ai integration', 'progress report', 'task synchronization', 'project management'],
        commits: []
      },
      {
        name: 'Document Management & File Uploads',
        keywords: ['document', 'upload', 'file', 'attachment', 'storage', 'document center'],
        commits: []
      },
      {
        name: 'Real-Time Communication & Chat',
        keywords: ['chat', 'messaging', 'real-time', 'communication', 'typing indicator', 'socket'],
        commits: []
      },
      {
        name: 'Role-Based Access Control (RBAC)',
        keywords: ['rbac', 'role', 'permission', 'access control', 'user management', 'authorization'],
        commits: []
      },
      {
        name: 'Legal Research & AI Assistant',
        keywords: ['legal', 'ucc', 'uniform commercial code', 'us code', 'ai assistant', 'legal research'],
        commits: []
      },
      {
        name: 'User Interface & Experience',
        keywords: ['ui', 'ux', 'responsive', 'layout', 'mobile', 'design', 'interface', 'appearance'],
        commits: []
      },
      {
        name: 'Authentication & Security',
        keywords: ['auth', 'security', 'login', 'session', 'validation', 'authentication'],
        commits: []
      },
      {
        name: 'System Configuration & Settings',
        keywords: ['settings', 'configuration', 'system', 'admin', 'management', 'setup'],
        commits: []
      },
      {
        name: 'Data Management & Database',
        keywords: ['database', 'data', 'migration', 'schema', 'initialization', 'duplicate'],
        commits: []
      },
      {
        name: 'Notifications & Email',
        keywords: ['notification', 'email', 'alert', 'preferences', 'delivery'],
        commits: []
      }
    ];

    // Categorize each commit
    commits.forEach(commit => {
      const message = commit.message.toLowerCase();
      let categorized = false;

      for (const category of categories) {
        if (category.keywords.some(keyword => message.includes(keyword.toLowerCase()))) {
          category.commits.push(commit);
          categorized = true;
          break;
        }
      }

      // If not categorized, add to a miscellaneous category
      if (!categorized) {
        let miscCategory = categories.find(c => c.name === 'General Improvements');
        if (!miscCategory) {
          miscCategory = {
            name: 'General Improvements',
            keywords: [],
            commits: []
          };
          categories.push(miscCategory);
        }
        miscCategory.commits.push(commit);
      }
    });

    // Filter out empty categories
    return categories.filter(category => category.commits.length > 0);
  }

  /**
   * Generate and send cumulative progress report
   */
  public async generateCumulativeReport(sinceDate: string = '1 month ago', sendToDart: boolean = true): Promise<void> {
    try {
      console.log('[GitProgress] Generating cumulative progress report...');
      
      const analysis = await this.analyzeGitHistory(sinceDate);
      
      // Generate natural language summary
      const summary = this.generateProgressSummary(analysis);
      
      // Generate detailed breakdown
      const { added, fixed, improved } = this.categorizeChanges(analysis);
      
      // Save comprehensive report
      await this.saveComprehensiveReport(analysis, summary);
      
      // Send to Dart AI if requested
      if (sendToDart) {
        await this.devProgressService.sendProgressUpdate({
          summary,
          added,
          fixed,
          improved
        });
        
        console.log('[GitProgress] Cumulative report sent to Dart AI successfully');
      }
      
      // Display report to console
      this.displayReport(analysis, summary);
      
    } catch (error) {
      console.error('[GitProgress] Error generating cumulative report:', error);
      throw error;
    }
  }

  /**
   * Generate natural language progress summary
   */
  private generateProgressSummary(analysis: GitAnalysisResult): string {
    const { totalCommits, categories, topContributors, fileStats } = analysis;
    
    const majorFeatures = categories
      .filter(cat => cat.commits.length >= 3)
      .map(cat => cat.name)
      .slice(0, 3);
    
    let summary = `Comprehensive development progress spanning ${analysis.dateRange} with ${totalCommits} commits. `;
    
    if (majorFeatures.length > 0) {
      summary += `Major development areas include: ${majorFeatures.join(', ')}. `;
    }
    
    if (fileStats.filesChanged > 0) {
      summary += `Code changes: ${fileStats.filesChanged} files modified, ${fileStats.additions} additions, ${fileStats.deletions} deletions. `;
    }
    
    if (topContributors.length > 0) {
      summary += `Primary contributor: ${topContributors[0].author} (${topContributors[0].commits} commits).`;
    }
    
    return summary;
  }

  /**
   * Categorize changes for progress reporting
   */
  private categorizeChanges(analysis: GitAnalysisResult): { added: string[], fixed: string[], improved: string[] } {
    const added: string[] = [];
    const fixed: string[] = [];
    const improved: string[] = [];
    
    analysis.categories.forEach(category => {
      const commitCount = category.commits.length;
      const categoryName = category.name;
      
      // Determine if this represents new features, fixes, or improvements
      const hasNewKeywords = category.commits.some(c => 
        c.message.toLowerCase().includes('add') || 
        c.message.toLowerCase().includes('implement') ||
        c.message.toLowerCase().includes('create')
      );
      
      const hasFixKeywords = category.commits.some(c => 
        c.message.toLowerCase().includes('fix') || 
        c.message.toLowerCase().includes('resolve') ||
        c.message.toLowerCase().includes('address')
      );
      
      const hasImproveKeywords = category.commits.some(c => 
        c.message.toLowerCase().includes('improve') || 
        c.message.toLowerCase().includes('enhance') ||
        c.message.toLowerCase().includes('update')
      );
      
      if (hasNewKeywords) {
        added.push(`${categoryName} (${commitCount} commits)`);
      } else if (hasFixKeywords) {
        fixed.push(`${categoryName} (${commitCount} commits)`);
      } else if (hasImproveKeywords) {
        improved.push(`${categoryName} (${commitCount} commits)`);
      } else {
        improved.push(`${categoryName} (${commitCount} commits)`);
      }
    });
    
    return { added, fixed, improved };
  }

  /**
   * Save comprehensive report to file
   */
  private async saveComprehensiveReport(analysis: GitAnalysisResult, summary: string): Promise<void> {
    const reportsDir = '.dart-reports';
    await fs.mkdir(reportsDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(reportsDir, `git-analysis-${timestamp}.json`);
    
    const report = {
      timestamp: new Date().toISOString(),
      summary,
      analysis,
      generatedBy: 'GitIntegratedProgressService'
    };
    
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`[GitProgress] Comprehensive report saved to ${reportPath}`);
  }

  /**
   * Display formatted report to console
   */
  private displayReport(analysis: GitAnalysisResult, summary: string): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 CUMULATIVE DEVELOPMENT PROGRESS REPORT');
    console.log('='.repeat(80));
    console.log(`📅 Period: ${analysis.dateRange}`);
    console.log(`📈 Total Commits: ${analysis.totalCommits}`);
    console.log(`📁 Files Changed: ${analysis.fileStats.filesChanged}`);
    console.log(`➕ Lines Added: ${analysis.fileStats.additions}`);
    console.log(`➖ Lines Removed: ${analysis.fileStats.deletions}`);
    console.log('\n📝 SUMMARY:');
    console.log(summary);
    console.log('\n🏗️ DEVELOPMENT CATEGORIES:');
    
    analysis.categories.forEach(category => {
      console.log(`  • ${category.name}: ${category.commits.length} commits`);
    });
    
    console.log('\n👥 TOP CONTRIBUTORS:');
    analysis.topContributors.forEach((contributor, index) => {
      console.log(`  ${index + 1}. ${contributor.author}: ${contributor.commits} commits`);
    });
    
    console.log('='.repeat(80) + '\n');
  }

  /**
   * Get git repository status
   */
  public async getGitStatus(): Promise<string> {
    try {
      const { stdout } = await execAsync('git status --porcelain');
      return stdout.trim() || 'Working directory clean';
    } catch (error) {
      return 'Could not determine git status';
    }
  }

  /**
   * Get current branch information
   */
  public async getCurrentBranch(): Promise<string> {
    try {
      const { stdout } = await execAsync('git branch --show-current');
      return stdout.trim() || 'Unknown branch';
    } catch (error) {
      return 'Unknown branch';
    }
  }
}