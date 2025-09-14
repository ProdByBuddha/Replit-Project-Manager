# Family Portal Application

## Overview

A full-stack TypeScript application designed to manage family-based case management and document workflows. The system provides separate interfaces for families and administrators, featuring task management, document uploads, real-time messaging, and progress tracking. Built with React/Vite frontend, Express backend, PostgreSQL database using Drizzle ORM, and integrated with Google Cloud Storage for file management.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript and Vite bundler
- **UI Library**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation via Hookform Resolvers

### Backend Architecture
- **Runtime**: Node.js with TypeScript and ESM modules
- **Framework**: Express.js with middleware for logging, JSON parsing, and error handling
- **Database ORM**: Drizzle ORM with PostgreSQL dialect and migration support
- **Session Management**: Express sessions with PostgreSQL store for persistence
- **File Uploads**: Multer middleware with direct-to-S3 upload capability
- **Development**: TSX for TypeScript execution and hot reloading

### Authentication & Authorization
- **Provider**: Replit Auth using OpenID Connect (OIDC) protocol
- **Strategy**: Passport.js with OpenID Client strategy
- **Session Storage**: PostgreSQL-backed sessions with configurable TTL
- **Role-Based Access**: Two-tier system (family users and admin users)
- **Family Access**: Code-based family authentication system

### Data Storage Design
- **Primary Database**: PostgreSQL via Neon serverless with connection pooling
- **Schema Management**: Drizzle Kit for migrations and schema evolution
- **Object Storage**: Google Cloud Storage with custom ACL implementation
- **Session Store**: Dedicated PostgreSQL table for session persistence

### File Management System
- **Storage Provider**: Google Cloud Storage with Replit sidecar authentication
- **Upload Strategy**: Direct-to-cloud uploads using presigned URLs
- **ACL System**: Custom object-level access control with group-based permissions
- **File Organization**: Path-based organization with public/private separation
- **Upload Interface**: Uppy dashboard for multi-file management with progress tracking

### Real-time Features
- **WebSocket Communication**: Socket.IO for real-time messaging with session authentication
- **Chat System**: Family and inter-family messaging with connection codes
- **Query Invalidation**: Automatic cache updates on data mutations
- **Optimistic Updates**: Client-side state updates for improved UX
- **Error Boundaries**: Comprehensive error handling with user feedback
- **Toast Notifications**: Real-time user feedback for all operations
- **Typing Indicators**: Real-time typing status in chat windows

## External Dependencies

### Cloud Services
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Google Cloud Storage**: Object storage for document and file management
- **Replit Authentication**: OIDC-based user authentication service
- **Replit Sidecar**: Service mesh for secure cloud service access
- **Dart AI**: Project management integration for automatic progress reporting (Workspace: Eric Parker/Tasks, Space ID: LTPknvYLuLH9)

### UI Component Libraries
- **Radix UI**: Accessible, unstyled component primitives
- **Shadcn/ui**: Pre-styled component system built on Radix
- **Lucide React**: Icon library for consistent iconography
- **Tailwind CSS**: Utility-first CSS framework for styling

### Development Tools
- **Vite**: Frontend build tool with HMR and optimized bundling
- **TanStack Query**: Server state management and caching solution
- **Uppy**: File upload library with cloud storage integration
- **Drizzle Kit**: Database migration and introspection tooling

### Runtime Dependencies
- **Express**: Web application framework for API routing
- **Passport**: Authentication middleware for various strategies
- **Multer**: Multipart form data handling for file uploads
- **Connect-PG-Simple**: PostgreSQL session store for Express

## Development & Project Management

### Git-Integrated Progress Reporting System
A comprehensive system for analyzing git history and generating client-friendly progress reports automatically sent to Dart AI.

**Core Functionality:**
- Analyzes complete git commit history and categorizes development work
- Generates natural language progress summaries for client communication
- Integrates directly with Replit's git repository using shell commands
- Automatically sends cumulative reports to Eric Parker's Dart AI workspace

**Available CLI Commands:**
- `npx tsx server/cli/gitprogress.ts analyze --since "period"` - Analyze git history patterns
- `npx tsx server/cli/gitprogress.ts report --since "period"` - Generate and send comprehensive reports
- `npx tsx server/cli/gitprogress.ts quick --days N` - Quick updates for recent work
- `npx tsx server/cli/gitprogress.ts status` - Check repository status

**When to Use Git Progress Reporting:**
1. **Project Milestones** - After completing major features or development phases
2. **Client Updates** - When clients need comprehensive progress summaries
3. **Weekly/Monthly Reports** - Regular scheduled progress communications
4. **Development Reviews** - When analyzing productivity and development patterns
5. **Feature Completion** - After finishing significant feature implementations
6. **Bug Fix Cycles** - When reporting resolution of multiple issues
7. **Architecture Changes** - After major system refactoring or improvements

**Integration Details:**
- Service: `GitIntegratedProgressService` in `server/services/gitIntegratedProgress.ts`
- CLI Tool: `server/cli/gitprogress.ts`
- Dart AI Target: Eric Parker/Tasks workspace (LTPknvYLuLH9)
- Report Storage: `.dart-reports/` directory with JSON archives
- Categories: 11 automatic development categories (Dart AI Integration, Document Management, Real-Time Communication, RBAC, Legal Research, UI/UX, Authentication, System Configuration, Data Management, Notifications, General Improvements)

**Best Practices:**
- Use `--preview` flag to review reports before sending
- Include appropriate time periods (`--since "1 month ago"`, `--days 7`)
- Regular cumulative reports help maintain client visibility
- Quick updates for immediate progress communication
- Analyze patterns to improve development efficiency

### Cost-Benefit Analysis System
A comprehensive system that measures actual development progress against historical industry benchmarks to demonstrate concrete client savings.

**Core Functionality:**
- Calculates Work Contribution Units (WCU) from git commit history and file changes
- Compares traditional development estimates (using COCOMO II, ISBSG, DORA benchmarks) vs actual development time
- Generates compelling client savings reports showing hours, dollars, and weeks saved
- Integrates seamlessly with existing progress reporting and Dart AI communication

**Industry Benchmarks Integrated:**
- COCOMO II 2000 Model Definition parameters for effort estimation
- ISBSG 2023 Development & Enhancement Repository hourly rates
- DORA State of DevOps Report 2024 throughput benchmarks
- Regional cost adjustments and risk-based multipliers

**Savings Calculation Formula:**
- Traditional Hours = WCU * categoryMultiplier * riskFactor * hoursPerWCU
- Actual Hours = commits * avgHoursPerCommit (with category-specific adjustments)
- Savings = max(Traditional Hours - Actual Hours, 0)
- Dollar Savings = Savings Hours * blended hourly rate
- Weeks Saved = Savings Hours / team capacity hours per week

**Available Commands:**
- `npx tsx server/cli/gitprogress.ts analyze --since "period"` - Git analysis with savings calculation
- `npx tsx server/cli/gitprogress.ts savings --since "period"` - Detailed savings breakdown
- `npx tsx server/cli/gitprogress.ts calibrate --actual-hours N` - Calibrate estimates against known data
- `npx tsx server/cli/gitprogress.ts report --since "period"` - Send comprehensive reports to Dart AI

**Client Value Demonstration:**
Every progress report now includes compelling headlines like:
- "💰 MAJOR SAVINGS ACHIEVED: $XXX,XXX (45% cost reduction)"
- "⚡ X weeks ahead of traditional timeline"
- "🚀 X.X productivity multiplier vs industry standards"

**When to Highlight Savings:**
1. **Major Development Phases** - After completing significant feature sets or milestones
2. **Monthly Client Reports** - Regular savings summaries for ongoing relationship value
3. **Project Retrospectives** - Demonstrating total value delivered vs traditional approaches
4. **New Client Presentations** - Historical data proving development efficiency and cost savings
5. **Contract Renewals** - Concrete ROI data supporting continued collaboration
6. **Stakeholder Updates** - Executive-level summaries showing business impact and value