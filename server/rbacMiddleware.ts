// Role-Based Access Control (RBAC) Middleware
// Provides fine-grained access control for API routes

import type { RequestHandler } from "express";
import { storage } from "./storage";
import { hasPermission, canAccessRoute, isAdmin, hasMinimumRole, type UserRole, type Permission } from "@shared/permissions";

// Enhanced request interface to include user data with role information
interface AuthenticatedRequest extends Express.Request {
  user: {
    claims: {
      sub: string;
      email?: string;
      first_name?: string;
      last_name?: string;
      profile_image_url?: string;
      exp?: number;
    };
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
  };
  userRole?: UserRole;
  userFamilyId?: string;
}

// Middleware to load and attach user role information
export const loadUserRole: RequestHandler = async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: "User ID not found in token" });
    }

    // Fetch user from database to get role and family info
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Attach role and family information to request
    req.userRole = user.role as UserRole;
    req.userFamilyId = user.familyId || undefined;
    
    next();
  } catch (error) {
    console.error("Error loading user role:", error);
    res.status(500).json({ message: "Failed to load user role" });
  }
};

// Middleware factory to require specific permissions
export function requirePermission(permission: Permission): RequestHandler {
  return (req: AuthenticatedRequest, res, next) => {
    const userRole = req.userRole;
    
    if (!userRole) {
      return res.status(401).json({ 
        message: "User role not loaded",
        code: "ROLE_NOT_LOADED"
      });
    }

    if (!hasPermission(userRole, permission)) {
      return res.status(403).json({ 
        message: `Insufficient permissions. Required: ${permission}`,
        code: "INSUFFICIENT_PERMISSIONS",
        required: permission,
        userRole: userRole
      });
    }

    next();
  };
}

// Middleware factory to require minimum role level
export function requireRole(minimumRole: UserRole): RequestHandler {
  return (req: AuthenticatedRequest, res, next) => {
    const userRole = req.userRole;
    
    if (!userRole) {
      return res.status(401).json({ 
        message: "User role not loaded",
        code: "ROLE_NOT_LOADED"
      });
    }

    const hasRequiredRole = hasMinimumRole(userRole, minimumRole);
    if (!hasRequiredRole) {
      return res.status(403).json({ 
        message: `Insufficient role level. Required: ${minimumRole} or higher`,
        code: "INSUFFICIENT_ROLE",
        required: minimumRole,
        userRole: userRole
      });
    }

    next();
  };
}

// Middleware to require admin role (ministry_admin or platform_admin)
export const requireAdmin: RequestHandler = (req: AuthenticatedRequest, res, next) => {
  const userRole = req.userRole;
  
  if (!userRole) {
    return res.status(401).json({ 
      message: "User role not loaded",
      code: "ROLE_NOT_LOADED"
    });
  }

  if (!isAdmin(userRole)) {
    return res.status(403).json({ 
      message: "Admin access required",
      code: "ADMIN_REQUIRED",
      userRole: userRole
    });
  }

  next();
};

// Middleware to require platform admin role
export const requirePlatformAdmin: RequestHandler = (req: AuthenticatedRequest, res, next) => {
  const userRole = req.userRole;
  
  if (!userRole) {
    return res.status(401).json({ 
      message: "User role not loaded",
      code: "ROLE_NOT_LOADED"
    });
  }

  if (userRole !== 'platform_admin') {
    return res.status(403).json({ 
      message: "Platform admin access required",
      code: "PLATFORM_ADMIN_REQUIRED",
      userRole: userRole
    });
  }

  next();
};

// Middleware to ensure user can only access their own family data
export const requireFamilyMember: RequestHandler = (req: AuthenticatedRequest, res, next) => {
  const userFamilyId = req.userFamilyId;
  const requestedFamilyId = req.params.familyId || req.body.familyId || req.query.familyId;
  const userRole = req.userRole;

  // Admin users can access any family data
  if (userRole && isAdmin(userRole)) {
    return next();
  }

  // Family members can only access their own family data
  if (!userFamilyId) {
    return res.status(403).json({ 
      message: "User is not associated with any family",
      code: "NO_FAMILY_ASSOCIATION"
    });
  }

  if (requestedFamilyId && userFamilyId !== requestedFamilyId) {
    return res.status(403).json({ 
      message: "Access denied. You can only access your own family data",
      code: "FAMILY_ACCESS_DENIED",
      userFamilyId: userFamilyId,
      requestedFamilyId: requestedFamilyId
    });
  }

  next();
};

// Middleware to check route-specific permissions
export function requireRouteAccess(route: string): RequestHandler {
  return (req: AuthenticatedRequest, res, next) => {
    const userRole = req.userRole;
    
    if (!userRole) {
      return res.status(401).json({ 
        message: "User role not loaded",
        code: "ROLE_NOT_LOADED"
      });
    }

    if (!canAccessRoute(userRole, route)) {
      return res.status(403).json({ 
        message: `Access denied to route: ${route}`,
        code: "ROUTE_ACCESS_DENIED",
        route: route,
        userRole: userRole
      });
    }

    next();
  };
}

// Combined middleware for common authentication flow
export const authenticateWithRole: RequestHandler[] = [
  loadUserRole
];

// Combined middleware for admin routes
export const authenticateAdmin: RequestHandler[] = [
  loadUserRole,
  requireAdmin
];

// Combined middleware for platform admin routes
export const authenticatePlatformAdmin: RequestHandler[] = [
  loadUserRole,
  requirePlatformAdmin
];

// Combined middleware for family-specific routes
export const authenticateFamily: RequestHandler[] = [
  loadUserRole,
  requireFamilyMember
];

// Helper function to create custom permission chains
export function createPermissionChain(...permissions: Permission[]): RequestHandler[] {
  return [
    loadUserRole,
    ...permissions.map(permission => requirePermission(permission))
  ];
}

// Helper function to create role-based chains
export function createRoleChain(minimumRole: UserRole): RequestHandler[] {
  return [
    loadUserRole,
    requireRole(minimumRole)
  ];
}

// Export types for use in routes
export type { AuthenticatedRequest };

// hasMinimumRole is now imported from @shared/permissions