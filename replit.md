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
- **Query Invalidation**: Automatic cache updates on data mutations
- **Optimistic Updates**: Client-side state updates for improved UX
- **Error Boundaries**: Comprehensive error handling with user feedback
- **Toast Notifications**: Real-time user feedback for all operations

## External Dependencies

### Cloud Services
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Google Cloud Storage**: Object storage for document and file management
- **Replit Authentication**: OIDC-based user authentication service
- **Replit Sidecar**: Service mesh for secure cloud service access

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