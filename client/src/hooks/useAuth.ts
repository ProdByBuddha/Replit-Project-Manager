import { useQuery } from "@tanstack/react-query";
import type { UserWithFamily } from "@/lib/types";
import { 
  hasPermission, 
  canAccessRoute, 
  isAdmin, 
  isPlatformAdmin,
  canAccessAdmin,
  canManageAllFamilies,
  canViewAllFamilies,
  getEnabledFeatures,
  getRoleDisplayName,
  type UserRole, 
  type Permission 
} from "@shared/permissions";

export function useAuth() {
  const { data: user, isLoading } = useQuery<UserWithFamily>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  // Role-based utility functions
  const userRole = user?.role as UserRole;
  
  const hasUserPermission = (permission: Permission): boolean => {
    if (!userRole) return false;
    return hasPermission(userRole, permission);
  };

  const canUserAccessRoute = (route: string): boolean => {
    if (!userRole) return false;
    return canAccessRoute(userRole, route);
  };

  const isUserAdmin = (): boolean => {
    if (!userRole) return false;
    return isAdmin(userRole);
  };

  const isUserPlatformAdmin = (): boolean => {
    if (!userRole) return false;
    return isPlatformAdmin(userRole);
  };

  const canUserAccessAdmin = (): boolean => {
    if (!userRole) return false;
    return canAccessAdmin(userRole);
  };

  const canUserManageAllFamilies = (): boolean => {
    if (!userRole) return false;
    return canManageAllFamilies(userRole);
  };

  const canUserViewAllFamilies = (): boolean => {
    if (!userRole) return false;
    return canViewAllFamilies(userRole);
  };

  const getUserEnabledFeatures = () => {
    if (!userRole) return null;
    return getEnabledFeatures(userRole);
  };

  const getUserRoleDisplayName = (): string => {
    if (!userRole) return '';
    return getRoleDisplayName(userRole);
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    userRole,
    
    // Permission checking functions
    hasPermission: hasUserPermission,
    canAccessRoute: canUserAccessRoute,
    
    // Role checking functions
    isAdmin: isUserAdmin,
    isPlatformAdmin: isUserPlatformAdmin,
    canAccessAdmin: canUserAccessAdmin,
    canManageAllFamilies: canUserManageAllFamilies,
    canViewAllFamilies: canUserViewAllFamilies,
    
    // Feature and display utilities
    enabledFeatures: getUserEnabledFeatures(),
    roleDisplayName: getUserRoleDisplayName(),
    
    // Direct access to permissions from API response (if available)
    permissions: user?.permissions || [],
    apiEnabledFeatures: user?.enabledFeatures,
  };
}
