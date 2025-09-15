# Replit Project Manager

A comprehensive git-integrated project management tool with cost-benefit analysis for Dart AI and Replit workflows. Automatically tracks development progress, calculates cost savings compared to traditional development methods, and reports results to clients via Dart AI.

## 🚀 Features

- **Git-Integrated Progress Analysis** - Automatically analyze git history and categorize development work
- **Cost-Benefit Analysis** - Calculate savings compared to traditional development using industry benchmarks
- **Industry-Standard Metrics** - Based on COCOMO II, ISBSG, and DORA methodologies
- **Dart AI Integration** - Automatically send client-friendly progress reports
- **CLI Tools** - Command-line tools for easy integration into workflows
- **TypeScript Support** - Full TypeScript support with comprehensive types

## 📊 What It Calculates

The tool analyzes your git repository and calculates:

- **Traditional Development Estimates** using COCOMO II, ISBSG, and DORA benchmarks
- **Actual Development Time** based on git commit patterns and file changes
- **Cost Savings** in dollars, hours, and weeks compared to traditional methods
- **ROI and Efficiency Metrics** including productivity multipliers
- **Confidence Scoring** to validate the accuracy of estimates
- **Replit Agent Metrics** - Time worked, actions performed, items read, code changes, and agent usage costs per commit

## 📦 Installation

```bash
npm install replit-project-manager
```

Or clone this repository:

```bash
git clone https://github.com/yourusername/replit-project-manager.git
cd replit-project-manager
npm install
```

## ⚙️ Setup

### Environment Variables

Create a `.env` file in your project root:

```bash
# Required for Dart AI integration
DART_TOKEN=your_dart_token_here

# Optional configuration
DART_WORKSPACE_ID=your_workspace_id
DART_DARTBOARD=your_dartboard_name
```

### Get Your Dart Token

1. Go to [Dart AI](https://app.itsdart.com)
2. Navigate to Settings → API Tokens
3. Create a new token and copy it to your `.env` file

## 🛠️ CLI Usage

### Git Progress Analysis

```bash
# Analyze recent development with cost savings
npx rpm-gitprogress analyze --since "1 month ago"

# Get JSON output for integration
npx rpm-gitprogress analyze --json

# Analyze without savings calculation
npx rpm-gitprogress analyze --no-savings

# Check git repository status
npx rpm-gitprogress status
```

### Progress Reporting to Dart AI

```bash
# Send comprehensive progress report
npx rpm-devprogress send \
  --summary "Completed user authentication system" \
  --added "Login functionality" "Password reset" \
  --fixed "Security vulnerabilities" \
  --improved "Database performance"

# Quick progress update
npx rpm-devprogress quick --message "Fixed critical payment bug"

# Test Dart AI connection
npx rpm-devprogress test

# Check service status
npx rpm-devprogress status
```

## 💻 Programmatic Usage

### Basic Setup

```typescript
import ReplitProjectManager from 'replit-project-manager';

const rpm = ReplitProjectManager.getInstance();

// Initialize with Dart AI configuration
await rpm.initialize({
  dartToken: 'your_dart_token',
  workspaceId: 'your_workspace_id',
  dartboard: 'your_dartboard_name'
});
```

### Analyze Git History with Savings

```typescript
// Analyze development progress and calculate savings
const analysis = await rpm.analyzeProject('1 month ago', true);

console.log(`Total commits: ${analysis.totalCommits}`);
console.log(`Cost savings: $${analysis.savings?.calculation.savings.dollars}`);
console.log(`Time saved: ${analysis.savings?.calculation.savings.weeks} weeks`);
```

### Send Progress Reports

```typescript
// Send comprehensive progress update
await rpm.sendProgressUpdate(
  'Completed major feature development',
  {
    added: ['User dashboard', 'Real-time notifications'],
    fixed: ['Database connection issues', 'Memory leaks'],
    improved: ['Performance optimization', 'UI responsiveness']
  }
);
```

### Advanced Usage

```typescript
import { 
  GitIntegratedProgressService,
  SavingsCalculator,
  DevProgressService 
} from 'replit-project-manager';

// Use individual services
const gitService = GitIntegratedProgressService.getInstance();
const savingsService = SavingsCalculator.getInstance();
const progressService = DevProgressService.getInstance();

// Initialize services
await gitService.initialize();
await savingsService.initialize();

// Analyze git history
const analysis = await gitService.analyzeGitHistory('2 weeks ago', {
  enableSavings: true,
  confidenceThreshold: 80
});

// Send custom progress report
await progressService.sendProgressUpdate({
  summary: 'Custom progress update',
  savings: analysis.savings
});
```

## 🏗️ Project Structure

```
replit-project-manager/
├── src/
│   ├── estimation/          # Cost calculation services
│   │   ├── benchmarks.ts    # Industry benchmarks (COCOMO II, ISBSG, DORA)
│   │   ├── estimator.ts     # Work Contribution Units calculation
│   │   └── savingsCalculator.ts # Savings analysis engine
│   ├── git/                 # Git integration
│   │   └── gitIntegration.ts
│   ├── progress/            # Progress reporting
│   │   └── dartProgress.ts
│   ├── types.ts             # TypeScript definitions
│   ├── validation.ts        # Input validation and security
│   └── index.ts             # Main exports
├── cli/                     # Command-line tools
│   ├── gitprogress.ts       # Git analysis CLI
│   └── devprogress.ts       # Progress reporting CLI
├── benchmarks/              # Industry benchmark data
│   ├── industry.json        # Default industry standards
│   └── project.json         # Project-specific overrides
└── examples/                # Usage examples
```

## 📈 Cost-Benefit Analysis

The tool uses industry-standard methodologies to calculate savings:

### Industry Benchmarks Integrated

- **COCOMO II 2000** - Effort estimation model parameters
- **ISBSG 2023** - International Software Benchmarking Standards Group rates
- **DORA 2024** - DevOps Research and Assessment throughput benchmarks

### Calculation Formula

```
Traditional Hours = WCU × Category Multiplier × Risk Factor × Hours per WCU
Actual Hours = Commits × Average Hours per Commit (category-adjusted)
Savings = max(Traditional Hours - Actual Hours, 0)
Dollar Savings = Savings Hours × Blended Hourly Rate
Weeks Saved = Savings Hours ÷ Team Capacity Hours per Week
```

### Example Output

```
🤖 REPLIT AGENT METRICS:
  Total Time Worked: 42 hours
  Total Work Done: 1,234 actions
  Total Items Read: 15,678 lines
  Total Code Changed: +2,345/-567 lines
  Total Agent Usage: $45.67

💰 MAJOR SAVINGS ACHIEVED: $127,500 (73% cost reduction)
⚡ 8.2 weeks ahead of traditional timeline  
🚀 2.4x productivity multiplier vs industry standards
🎯 Confidence: 89%
```

## 🔧 Configuration

### Benchmark Customization

Create `benchmarks/project.json` to override defaults:

```json
{
  "projectType": "webApplication",
  "region": "northAmerica", 
  "teamSize": 5,
  "customRates": {
    "seniorDeveloper": 120,
    "midLevelDeveloper": 85
  },
  "riskFactors": ["highComplexity", "newTechnology"]
}
```

### Git Analysis Options

```typescript
const analysis = await gitService.analyzeGitHistory('1 month ago', {
  enableSavings: true,              // Calculate cost savings
  confidenceThreshold: 70,          // Minimum confidence for reporting
  projectParameters: {
    projectType: 'webApplication',
    region: 'northAmerica',
    teamSize: 5
  }
});
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Test individual components
npm run test:benchmarks
npm run test:estimator
npm run test:savings
```

## 🚀 Example Workflows

### Daily Progress Reports

```bash
#!/bin/bash
# daily-report.sh
npx rpm-devprogress quick --message "Daily progress: $(git log --oneline -1)"
```

### Weekly Comprehensive Analysis

```bash
#!/bin/bash
# weekly-analysis.sh
npx rpm-gitprogress analyze --since "1 week ago" > weekly-analysis.json
npx rpm-devprogress send --summary "Weekly development summary" --yes
```

### CI/CD Integration

```yaml
# .github/workflows/progress-report.yml
name: Development Progress Report
on:
  schedule:
    - cron: '0 9 * * 1'  # Monday 9 AM
jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install replit-project-manager
      - run: npx rpm-devprogress send --summary "Weekly automated report" --yes
        env:
          DART_TOKEN: ${{ secrets.DART_TOKEN }}
```

## 📚 Documentation

- [API Reference](./docs/api.md)
- [Configuration Guide](./docs/configuration.md)
- [Examples](./examples/)
- [Contributing](./CONTRIBUTING.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🆘 Support

- [GitHub Issues](https://github.com/yourusername/replit-project-manager/issues)
- [Documentation](https://github.com/yourusername/replit-project-manager/wiki)
- [Examples](./examples/)

---

**Built for developers who want to demonstrate concrete value and savings to their clients through data-driven development progress reporting.**