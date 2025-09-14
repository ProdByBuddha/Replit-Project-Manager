import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, User, Bell, Palette, Shield, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { ProfileResponse } from "@shared/schema";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().optional(),
  emailNotifications: z.boolean(),
  darkMode: z.boolean(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function ProfileSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Fetch user profile data
  const { data: profile, isLoading: profileLoading } = useQuery<ProfileResponse>({
    queryKey: ["/api/profile"],
    enabled: !!user,
  });

  // Form setup
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: profile?.firstName || "",
      lastName: profile?.lastName || "",
      phone: profile?.phone || "",
      emailNotifications: profile?.emailNotifications ?? true,
      darkMode: profile?.darkMode ?? false,
    },
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormValues) => {
      const response = await apiRequest("PUT", "/api/profile", data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: ProfileFormValues) => {
    setIsLoading(true);
    try {
      await updateProfileMutation.mutateAsync(data);
    } finally {
      setIsLoading(false);
    }
  };

  // Apply theme preference
  const handleThemeChange = (checked: boolean) => {
    if (checked) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Update form values when profile data loads
  if (profile && !form.formState.isDirty) {
    form.reset({
      firstName: profile.firstName || "",
      lastName: profile.lastName || "",
      phone: profile.phone || "",
      emailNotifications: profile.emailNotifications ?? true,
      darkMode: profile.darkMode ?? false,
    });
  }

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      family: "bg-blue-100 text-blue-800",
      executor: "bg-green-100 text-green-800",
      elder: "bg-purple-100 text-purple-800",
      legislator: "bg-yellow-100 text-yellow-800",
      ministry_admin: "bg-red-100 text-red-800",
      platform_admin: "bg-gray-100 text-gray-800",
    };
    return colors[role] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="container max-w-4xl mx-auto py-6 px-4 overflow-x-hidden">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Profile Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account information and preferences
        </p>
      </div>

      <div className="space-y-6">
        {/* Account Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Account Information
            </CardTitle>
            <CardDescription>
              Update your personal information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Enter your first name"
                            data-testid="input-first-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Enter your last name"
                            data-testid="input-last-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      value={user?.email || ""}
                      disabled
                      className="bg-muted"
                      data-testid="input-email"
                    />
                  </FormControl>
                  <FormDescription>
                    Email cannot be changed as it's managed by Replit Auth
                  </FormDescription>
                </FormItem>

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="tel"
                          placeholder="Enter your phone number"
                          data-testid="input-phone"
                        />
                      </FormControl>
                      <FormDescription>
                        Optional - for important notifications
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end mt-4">
                  <Button
                    type="submit"
                    disabled={isLoading || !form.formState.isDirty}
                    data-testid="button-save-profile"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Preferences
            </CardTitle>
            <CardDescription>
              Customize your experience
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="emailNotifications"
              render={({ field }) => (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4" />
                      <FormLabel className="text-base">Email Notifications</FormLabel>
                    </div>
                    <FormDescription>
                      Receive email updates about your tasks and messages
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-email-notifications"
                    />
                  </FormControl>
                </div>
              )}
            />

            <Separator />

            <FormField
              control={form.control}
              name="darkMode"
              render={({ field }) => (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <FormLabel className="text-base">Dark Mode</FormLabel>
                    <FormDescription>
                      Switch between light and dark theme
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        handleThemeChange(checked);
                      }}
                      data-testid="switch-dark-mode"
                    />
                  </FormControl>
                </div>
              )}
            />
          </CardContent>
        </Card>

        {/* Security & Access */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security & Access
            </CardTitle>
            <CardDescription>
              Your role and access information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Role</label>
              <div className="mt-2">
                <Badge
                  className={getRoleBadgeColor(user?.role || "family")}
                  data-testid="badge-user-role"
                >
                  {user?.role?.replace("_", " ").toUpperCase() || "FAMILY"}
                </Badge>
              </div>
            </div>

            {user?.familyId && profile?.familyCode && (
              <div>
                <label className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Family Code
                </label>
                <div className="mt-2">
                  <code
                    className="bg-muted px-3 py-2 rounded text-sm"
                    data-testid="text-family-code"
                  >
                    {profile.familyCode}
                  </code>
                  <p className="text-sm text-muted-foreground mt-2">
                    Share this code with family members to grant them access
                  </p>
                </div>
              </div>
            )}

            <div className="pt-4">
              <p className="text-sm text-muted-foreground">
                Authentication is managed by Replit Auth. To change your password or
                manage security settings, please visit your Replit account settings.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}