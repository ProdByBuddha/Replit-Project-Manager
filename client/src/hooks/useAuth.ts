import { useQuery } from "@tanstack/react-query";
import type { UserWithFamily } from "@/lib/types";

export function useAuth() {
  const { data: user, isLoading } = useQuery<UserWithFamily>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
