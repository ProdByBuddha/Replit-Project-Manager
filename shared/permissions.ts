// Role-based access control (RBAC) system
// Defines roles, permissions, and access control logic

export type UserRole = 'family' | 'executor' | 'elder' | 'legislator' | 'ministry_admin' | 'platform_admin';

// Define role hierarchy levels (higher number = more permissions)
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  'family': 0,
  'executor': 1,
  'elder': 2,
  'legislator': 3,
  'ministry_admin': 4,
  'platform_admin': 5,
};

// Define specific permissions for different actions
export enum Permission {
  // Family-level permissions
  VIEW_FAMILY_TASKS = 'view_family_tasks',
  UPDATE_FAMILY_TASKS = 'update_family_tasks',
  UPLOAD_DOCUMENTS = 'upload_documents',
  VIEW_FAMILY_DOCUMENTS = 'view_family_documents',
  
  // Communication permissions
  SEND_MESSAGES = 'send_messages',
  VIEW_FAMILY_MESSAGES = 'view_family_messages',
  
  // Invitation permissions
  INVITE_FAMILY_MEMBERS = 'invite_family_members',
  MANAGE_FAMILY_INVITATIONS = 'manage_family_invitations',
  
  // Ministry-specific permissions
  VIEW_STATUS_CORRECTION = 'view_status_correction',
  MANAGE_STATUS_CORRECTION = 'manage_status_correction',
  VIEW_MINISTRY_LEGITIMATION = 'view_ministry_legitimation',
  MANAGE_MINISTRY_LEGITIMATION = 'manage_ministry_legitimation',
  
  // Executor permissions
  EXECUTE_TASKS = 'execute_tasks',
  COMPLETE_FAMILY_TASKS = 'complete_family_tasks',
  MANAGE_TASK_ASSIGNMENTS = 'manage_task_assignments',
  
  // Elder permissions
  APPROVE_COMPLETIONS = 'approve_completions',
  REVIEW_DOCUMENTS = 'review_documents',
  OVERRIDE_TASK_STATUS = 'override_task_status',
  
  // Legislator permissions
  CREATE_RULES = 'create_rules',
  MODIFY_WORKFLOW_RULES = 'modify_workflow_rules',
  MANAGE_DEPENDENCIES = 'manage_dependencies',
  
  // Admin permissions
  VIEW_ALL_FAMILIES = 'view_all_families',
  MANAGE_ALL_FAMILIES = 'manage_all_families',
  VIEW_ADMIN_DASHBOARD = 'view_admin_dashboard',
  MANAGE_USERS = 'manage_users',
  MANAGE_TASKS = 'manage_tasks',
  VIEW_SYSTEM_STATS = 'view_system_stats',
  MANAGE_SYSTEM_SETTINGS = 'manage_system_settings',
  
  // Platform admin permissions
  MANAGE_PLATFORM = 'manage_platform',
  ACCESS_SYSTEM_LOGS = 'access_system_logs',
  MANAGE_INTEGRATIONS = 'manage_integrations',
}

// Define base permissions for each role (without inheritance)
const BASE_ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  'family': [
    Permission.VIEW_FAMILY_TASKS,
    Permission.UPDATE_FAMILY_TASKS,
    Permission.UPLOAD_DOCUMENTS,
    Permission.VIEW_FAMILY_DOCUMENTS,
    Permission.SEND_MESSAGES,
    Permission.VIEW_FAMILY_MESSAGES,
    Permission.INVITE_FAMILY_MEMBERS,
    Permission.MANAGE_FAMILY_INVITATIONS,
    Permission.VIEW_STATUS_CORRECTION,
    Permission.VIEW_MINISTRY_LEGITIMATION,
  ],
  
  'executor': [
    Permission.EXECUTE_TASKS,
    Permission.COMPLETE_FAMILY_TASKS,
    Permission.MANAGE_TASK_ASSIGNMENTS,
    Permission.MANAGE_STATUS_CORRECTION,
    Permission.MANAGE_MINISTRY_LEGITIMATION,
  ],
  
  'elder': [
    Permission.APPROVE_COMPLETIONS,
    Permission.REVIEW_DOCUMENTS,
    Permission.OVERRIDE_TASK_STATUS,
  ],
  
  'legislator': [
    Permission.CREATE_RULES,
    Permission.MODIFY_WORKFLOW_RULES,
    Permission.MANAGE_DEPENDENCIES,
  ],
  
  'ministry_admin': [
    Permission.VIEW_ALL_FAMILIES,
    Permission.MANAGE_ALL_FAMILIES,
    Permission.VIEW_ADMIN_DASHBOARD,
    Permission.MANAGE_USERS,
    Permission.MANAGE_TASKS,
    Permission.VIEW_SYSTEM_STATS,
    Permission.MANAGE_SYSTEM_SETTINGS,
  ],
  
  'platform_admin': [
    Permission.MANAGE_PLATFORM,
    Permission.ACCESS_SYSTEM_LOGS,
    Permission.MANAGE_INTEGRATIONS,
  ],
};

// Function to get all permissions for a role (including inherited ones)
export function getRolePermissions(role: UserRole): Permission[] {
  const allRoles: UserRole[] = ['family', 'executor', 'elder', 'legislator', 'ministry_admin', 'platform_admin'];
  const roleIndex = allRoles.indexOf(role);
  
  // Collect all permissions from current role and all lower roles
  const permissions: Permission[] = [];
  for (let i = 0; i <= roleIndex; i++) {
    permissions.push(...BASE_ROLE_PERMISSIONS[allRoles[i]]);
  }
  
  // Remove duplicates
  const uniquePermissions: Permission[] = [];
  for (const permission of permissions) {
    if (!uniquePermissions.includes(permission)) {
      uniquePermissions.push(permission);
    }
  }
  return uniquePermissions;
}

// Define which permissions each role has (with inheritance)
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  'family': getRolePermissions('family'),
  'executor': getRolePermissions('executor'),
  'elder': getRolePermissions('elder'),
  'legislator': getRolePermissions('legislator'),
  'ministry_admin': getRolePermissions('ministry_admin'),
  'platform_admin': getRolePermissions('platform_admin'),
};

// Helper function to check if a user has a specific permission
export function hasPermission(userRole: UserRole, permission: Permission): boolean {
  const rolePermissions = ROLE_PERMISSIONS[userRole];
  return rolePermissions.includes(permission);
}

// Helper function to check if a user has a minimum role level
export function hasMinimumRole(userRole: UserRole, minimumRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minimumRole];
}

// Helper function to check if a user is an admin (ministry or platform admin)
export function isAdmin(userRole: UserRole): boolean {
  return userRole === 'ministry_admin' || userRole === 'platform_admin';
}

// Helper function to check if a user is platform admin
export function isPlatformAdmin(userRole: UserRole): boolean {
  return userRole === 'platform_admin';
}

// Helper function to check if a user can access admin features
export function canAccessAdmin(userRole: UserRole): boolean {
  return hasPermission(userRole, Permission.VIEW_ADMIN_DASHBOARD);
}

// Helper function to check if a user can manage other families
export function canManageAllFamilies(userRole: UserRole): boolean {
  return hasPermission(userRole, Permission.MANAGE_ALL_FAMILIES);
}

// Helper function to check if a user can view all families
export function canViewAllFamilies(userRole: UserRole): boolean {
  return hasPermission(userRole, Permission.VIEW_ALL_FAMILIES);
}

// Helper function to get all available roles
export function getAllRoles(): UserRole[] {
  return Object.keys(ROLE_HIERARCHY) as UserRole[];
}

// Helper function to get role display name
export function getRoleDisplayName(role: UserRole): string {
  const roleNames: Record<UserRole, string> = {
    'family': 'Family Member',
    'executor': 'Executor',
    'elder': 'Elder',
    'legislator': 'Legislator',
    'ministry_admin': 'Ministry Administrator',
    'platform_admin': 'Platform Administrator',
  };
  return roleNames[role];
}

// Helper function to get role description
export function getRoleDescription(role: UserRole): string {
  const roleDescriptions: Record<UserRole, string> = {
    'family': 'Basic family member with access to family-specific tasks and documents',
    'executor': 'Can execute and manage tasks for families, with enhanced task management capabilities',
    'elder': 'Can approve task completions and review documents with oversight authority',
    'legislator': 'Can create and modify workflow rules and manage task dependencies',
    'ministry_admin': 'Full administrative access to all families and system management',
    'platform_admin': 'Ultimate system access including platform management and system logs',
  };
  return roleDescriptions[role];
}

// Navigation permissions - which routes each role can access
export const ROUTE_PERMISSIONS: Record<string, Permission> = {
  '/': Permission.VIEW_FAMILY_TASKS,
  '/status-correction': Permission.VIEW_STATUS_CORRECTION,
  '/ministry-legitimation': Permission.VIEW_MINISTRY_LEGITIMATION,
  '/admin': Permission.VIEW_ADMIN_DASHBOARD,
  '/notifications': Permission.VIEW_FAMILY_MESSAGES,
};

// Helper function to check if a user can access a specific route
export function canAccessRoute(userRole: UserRole, route: string): boolean {
  const requiredPermission = ROUTE_PERMISSIONS[route];
  if (!requiredPermission) {
    // If no specific permission is required, allow access
    return true;
  }
  return hasPermission(userRole, requiredPermission);
}

// Feature flags based on user role
export function getEnabledFeatures(userRole: UserRole) {
  return {
    // Navigation features
    showAdminDashboard: canAccessAdmin(userRole),
    showStatusCorrection: hasPermission(userRole, Permission.VIEW_STATUS_CORRECTION),
    showMinistryLegitimation: hasPermission(userRole, Permission.VIEW_MINISTRY_LEGITIMATION),
    
    // Task management features
    canEditTasks: hasPermission(userRole, Permission.UPDATE_FAMILY_TASKS),
    canExecuteTasks: hasPermission(userRole, Permission.EXECUTE_TASKS),
    canApproveTasks: hasPermission(userRole, Permission.APPROVE_COMPLETIONS),
    canManageAssignments: hasPermission(userRole, Permission.MANAGE_TASK_ASSIGNMENTS),
    canOverrideStatus: hasPermission(userRole, Permission.OVERRIDE_TASK_STATUS),
    
    // Document features
    canUploadDocuments: hasPermission(userRole, Permission.UPLOAD_DOCUMENTS),
    canReviewDocuments: hasPermission(userRole, Permission.REVIEW_DOCUMENTS),
    
    // Communication features
    canSendMessages: hasPermission(userRole, Permission.SEND_MESSAGES),
    canInviteMembers: hasPermission(userRole, Permission.INVITE_FAMILY_MEMBERS),
    
    // Admin features
    canViewAllFamilies: canViewAllFamilies(userRole),
    canManageAllFamilies: canManageAllFamilies(userRole),
    canManageUsers: hasPermission(userRole, Permission.MANAGE_USERS),
    canManageSystem: hasPermission(userRole, Permission.MANAGE_SYSTEM_SETTINGS),
    
    // Workflow features
    canCreateRules: hasPermission(userRole, Permission.CREATE_RULES),
    canModifyWorkflowRules: hasPermission(userRole, Permission.MODIFY_WORKFLOW_RULES),
    canManageDependencies: hasPermission(userRole, Permission.MANAGE_DEPENDENCIES),
  };
}