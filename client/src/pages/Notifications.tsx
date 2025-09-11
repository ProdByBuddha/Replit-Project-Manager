import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormDescription } from "@/components/ui/form";
import { Bell, Mail, FileText, MessageSquare, UserPlus, CheckCircle, Settings } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { insertNotificationPreferencesSchema, type InsertNotificationPreferences } from "@shared/schema";

type NotificationPreferences = InsertNotificationPreferences;

export default function Notifications() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const { data: preferences, isLoading: preferencesLoading } = useQuery<NotificationPreferences>({
    queryKey: ["/api/notifications/preferences"],
    enabled: !!user && isAuthenticated,
    retry: false,
  });

  const form = useForm<NotificationPreferences>({
    resolver: zodResolver(insertNotificationPreferencesSchema),
    defaultValues: {
      emailOnTaskStatus: true,
      emailOnDocumentUpload: true,
      emailOnAdminMessage: true,
      emailOnInvitations: true,
    },
  });

  // Update form when preferences are loaded
  useEffect(() => {
    if (preferences && !preferencesLoading) {
      form.reset(preferences);
    }
  }, [preferences, preferencesLoading, form]);

  const updatePreferencesMutation = useMutation({
    mutationFn: async (data: NotificationPreferences) => {
      const response = await apiRequest('PUT', '/api/notifications/preferences', data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Notification preferences updated successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/preferences"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update notification preferences",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: NotificationPreferences) => {
    updatePreferencesMutation.mutate(data);
  };

  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Settings className="h-8 w-8 animate-spin mx-auto mb-2 text-gray-500" />
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-600">Access Denied</CardTitle>
            <CardDescription className="text-center">
              Please log in to access notification preferences.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center space-x-2">
            <Bell className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Notification Preferences
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-300">
            Manage how and when you receive email notifications
          </p>
        </div>

        <Card data-testid="notification-preferences-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Mail className="h-5 w-5" />
              <span>Email Notifications</span>
            </CardTitle>
            <CardDescription>
              Choose which activities trigger email notifications. All notifications are sent to {user.email}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid gap-6">
                  <FormField
                    control={form.control}
                    name="emailOnTaskStatus"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="flex items-center space-x-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span>Task Status Changes</span>
                          </FormLabel>
                          <FormDescription>
                            Get notified when task statuses are updated in your family portal
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            data-testid="switch-task-status"
                            checked={field.value ?? true}
                            onCheckedChange={field.onChange}
                            disabled={preferencesLoading || updatePreferencesMutation.isPending}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="emailOnDocumentUpload"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="flex items-center space-x-2">
                            <FileText className="h-4 w-4 text-blue-600" />
                            <span>Document Uploads</span>
                          </FormLabel>
                          <FormDescription>
                            Get notified when new documents are uploaded to your family portal
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            data-testid="switch-document-upload"
                            checked={field.value ?? true}
                            onCheckedChange={field.onChange}
                            disabled={preferencesLoading || updatePreferencesMutation.isPending}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="emailOnAdminMessage"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="flex items-center space-x-2">
                            <MessageSquare className="h-4 w-4 text-purple-600" />
                            <span>Admin Messages</span>
                          </FormLabel>
                          <FormDescription>
                            Get notified when administrators send messages to your family
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            data-testid="switch-admin-message"
                            checked={field.value ?? true}
                            onCheckedChange={field.onChange}
                            disabled={preferencesLoading || updatePreferencesMutation.isPending}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="emailOnInvitations"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="flex items-center space-x-2">
                            <UserPlus className="h-4 w-4 text-orange-600" />
                            <span>Family Invitations</span>
                          </FormLabel>
                          <FormDescription>
                            Get notified when you receive invitations to join family portals
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            data-testid="switch-invitations"
                            checked={field.value ?? true}
                            onCheckedChange={field.onChange}
                            disabled={preferencesLoading || updatePreferencesMutation.isPending}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end pt-6">
                  <Button
                    type="submit"
                    data-testid="button-save-preferences"
                    disabled={updatePreferencesMutation.isPending || preferencesLoading}
                    className="min-w-[120px]"
                  >
                    {updatePreferencesMutation.isPending ? (
                      <div className="flex items-center space-x-2">
                        <Settings className="h-4 w-4 animate-spin" />
                        <span>Saving...</span>
                      </div>
                    ) : (
                      "Save Preferences"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Information Card */}
        <Card data-testid="notification-info-card">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Important Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
            <p>• Notifications are sent to prevent spam with a 5-minute rate limit between similar notifications.</p>
            <p>• You can change these preferences at any time by returning to this page.</p>
            <p>• All email notifications will be sent to your registered email address: <strong>{user.email}</strong></p>
            {user.role === 'admin' && (
              <p>• As an administrator, you may receive additional notifications about system activities.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}