import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Users, UserCheck, Crown, Gavel, Shield, Settings } from "lucide-react";
import PortalLayout from "@/components/PortalLayout";
import { getRoleDisplayName } from "@shared/permissions";
import type { UserRole } from "@shared/permissions";

// User data type for the management table
interface UserManagementData {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role: UserRole;
  familyId?: string;
  familyName?: string;
  profileImageUrl?: string;
  createdAt: string;
  updatedAt: string;
  displayName: string;
}

export default function UserManagement() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: users = [], isLoading } = useQuery<UserManagementData[]>({
    queryKey: ["/api/admin/users"],
    retry: false,
  });

  // Filter users based on search term
  const filteredUsers = users.filter(user => {
    const searchLower = searchTerm.toLowerCase();
    return (
      user.displayName.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      getRoleDisplayName(user.role).toLowerCase().includes(searchLower) ||
      user.familyName?.toLowerCase().includes(searchLower)
    );
  });

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'family':
        return Users;
      case 'executor':
        return UserCheck;
      case 'elder':
        return Crown;
      case 'legislator':
        return Gavel;
      case 'ministry_admin':
        return Shield;
      case 'platform_admin':
        return Settings;
      default:
        return Users;
    }
  };

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'family':
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case 'executor':
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case 'elder':
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case 'legislator':
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case 'ministry_admin':
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case 'platform_admin':
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getStatusText = (user: UserManagementData) => {
    // Simple status based on recent activity
    const lastActivity = new Date(user.updatedAt);
    const daysSinceActivity = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceActivity < 7) return "Active";
    if (daysSinceActivity < 30) return "Recent";
    return "Inactive";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case 'Recent':
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case 'Inactive':
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  if (isLoading) {
    return (
      <PortalLayout pageTitle="User Management">
        <Card className="bg-card border-border">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-card-foreground">User Management</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="animate-pulse">
              <div className="space-y-4 p-6">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-muted rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-1/4" />
                      <div className="h-3 bg-muted rounded w-1/6" />
                    </div>
                    <div className="w-20 h-6 bg-muted rounded" />
                    <div className="w-16 h-6 bg-muted rounded" />
                    <div className="w-24 h-3 bg-muted rounded" />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout pageTitle="User Management">
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-card-foreground" data-testid="text-user-management-title">
            User Management
          </CardTitle>
          <p className="text-muted-foreground mt-1">Manage system users and their roles</p>
          
          {/* Search Bar */}
          <div className="mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search users by name, email, or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-user-search"
              />
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {searchTerm ? (
                <p>No users found matching "{searchTerm}"</p>
              ) : (
                <p>No users found</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-3 sm:mx-0">
              <table className="w-full" data-testid="table-users">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Family
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Join Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredUsers.map((user) => {
                    const RoleIcon = getRoleIcon(user.role);
                    const status = getStatusText(user);
                    
                    return (
                      <tr key={user.id} className="hover:bg-muted/20" data-testid={`user-row-${user.id}`}>
                        <td className="px-3 sm:px-6 py-4">
                          <div className="flex items-center">
                            <Avatar className="w-10 h-10 mr-3">
                              <AvatarImage 
                                src={user.profileImageUrl} 
                                alt={user.displayName}
                                data-testid={`user-avatar-${user.id}`}
                              />
                              <AvatarFallback data-testid={`user-initials-${user.id}`}>
                                {user.displayName.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="text-sm font-medium text-card-foreground truncate max-w-[150px] sm:max-w-none" data-testid={`user-name-${user.id}`}>
                                {user.displayName}
                              </div>
                              <div className="text-sm text-muted-foreground truncate max-w-[150px] sm:max-w-none" data-testid={`user-email-${user.id}`}>
                                {user.email || 'No email'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4">
                          <Badge 
                            className={getRoleColor(user.role)}
                            data-testid={`user-role-${user.id}`}
                          >
                            <RoleIcon className="w-3 h-3 mr-1" />
                            {getRoleDisplayName(user.role)}
                          </Badge>
                        </td>
                        <td className="px-3 sm:px-6 py-4">
                          <Badge 
                            className={getStatusColor(status)}
                            data-testid={`user-status-${user.id}`}
                          >
                            {status}
                          </Badge>
                        </td>
                        <td className="px-3 sm:px-6 py-4 text-sm text-muted-foreground" data-testid={`user-family-${user.id}`}>
                          {user.familyId ? (
                            <span>Family Member</span>
                          ) : (
                            <span className="text-muted-foreground/60">No Family</span>
                          )}
                        </td>
                        <td className="px-3 sm:px-6 py-4 text-sm text-muted-foreground" data-testid={`user-join-date-${user.id}`}>
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Summary Footer */}
          <div className="border-t border-border px-6 py-4 bg-muted/20">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span data-testid="text-user-count">
                {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'} 
                {searchTerm && ` matching "${searchTerm}"`}
              </span>
              <span data-testid="text-total-users">
                Total: {users.length} users
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </PortalLayout>
  );
}