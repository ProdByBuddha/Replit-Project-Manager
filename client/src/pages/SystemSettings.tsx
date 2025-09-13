import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Settings, Bell, Shield, Zap, Link, Save, AlertTriangle, Info, Clock } from "lucide-react";
import PortalLayout from "@/components/PortalLayout";
import { apiRequest } from "@/lib/queryClient";

// Define setting types for better organization
interface SystemSetting {
  id: string;
  key: string;
  value: any;
  category: string;
  description?: string;
  isReadOnly: boolean;
  createdAt: string;
  updatedAt: string;
}

interface GroupedSettings {
  general?: SystemSetting[];
  notifications?: SystemSetting[];
  security?: SystemSetting[];
  features?: SystemSetting[];
  integrations?: SystemSetting[];
  scheduler?: SystemSetting[];
}

// Form schemas for different setting categories
const generalSettingsSchema = z.object({
  siteName: z.string().min(1, "Site name is required"),
  siteDescription: z.string(),
  maintenanceMode: z.boolean(),
  supportEmail: z.string().email("Invalid email address"),
  maxFamilySize: z.number().min(1).max(50),
});

const notificationSettingsSchema = z.object({
  emailNotificationsEnabled: z.boolean(),
  systemAlertsEnabled: z.boolean(),
  taskReminderEnabled: z.boolean(),
  documentUploadNotifications: z.boolean(),
  adminNotificationEmail: z.string().email("Invalid email address"),
});

const securitySettingsSchema = z.object({
  sessionTimeoutMinutes: z.number().min(5).max(1440),
  requireStrongPasswords: z.boolean(),
  maxFailedLogins: z.number().min(1).max(10),
  enableTwoFactor: z.boolean(),
  passwordMinLength: z.number().min(6).max(32),
});

const featureSettingsSchema = z.object({
  chatEnabled: z.boolean(),
  fileUploadsEnabled: z.boolean(),
  invitationsEnabled: z.boolean(),
  publicRegistration: z.boolean(),
  advancedWorkflowsEnabled: z.boolean(),
});

const integrationSettingsSchema = z.object({
  parlantApiEnabled: z.boolean(),
  emailServiceProvider: z.string(),
  objectStorageEnabled: z.boolean(),
  analyticsEnabled: z.boolean(),
  backupEnabled: z.boolean(),
});

const schedulerSettingsSchema = z.object({
  // US Code settings
  uscode_scheduler_enabled: z.boolean(),
  uscode_scheduler_schedule: z.string().min(1, "Cron schedule is required"),
  uscode_scheduler_incremental_enabled: z.boolean(),
  uscode_scheduler_max_retries: z.number().min(1).max(10),
  uscode_scheduler_timeout_minutes: z.number().min(5).max(300),
  uscode_scheduler_notify_on_failure: z.boolean(),
  // UCC settings
  ucc_scheduler_enabled: z.boolean(),
  ucc_scheduler_schedule: z.string().min(1, "Cron schedule is required"),
  ucc_scheduler_incremental_enabled: z.boolean(),
  ucc_scheduler_max_retries: z.number().min(1).max(10),
  ucc_scheduler_timeout_minutes: z.number().min(5).max(300),
  ucc_scheduler_notify_on_failure: z.boolean(),
  // Unified settings
  legal_scheduler_concurrent_execution: z.boolean(),
  legal_scheduler_resource_throttling: z.boolean(),
});

export default function SystemSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("general");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Fetch system settings
  const { data: settingsData, isLoading, error } = useQuery<GroupedSettings>({
    queryKey: ["/api/admin/settings"],
    retry: false,
  });

  // Helper function to get setting value by key
  const getSettingValue = (category: keyof GroupedSettings, key: string, defaultValue: any = "") => {
    const categorySettings = settingsData?.[category];
    const setting = categorySettings?.find(s => s.key === key);
    return setting?.value ?? defaultValue;
  };

  // Helper function to check if setting is read-only
  const isSettingReadOnly = (category: keyof GroupedSettings, key: string) => {
    const categorySettings = settingsData?.[category];
    const setting = categorySettings?.find(s => s.key === key);
    return setting?.isReadOnly ?? false;
  };

  // Initialize forms with current values
  const generalForm = useForm({
    resolver: zodResolver(generalSettingsSchema),
    defaultValues: {
      siteName: getSettingValue("general", "siteName", "Family Portal"),
      siteDescription: getSettingValue("general", "siteDescription", ""),
      maintenanceMode: getSettingValue("general", "maintenanceMode", false),
      supportEmail: getSettingValue("general", "supportEmail", ""),
      maxFamilySize: getSettingValue("general", "maxFamilySize", 10),
    },
  });

  const notificationForm = useForm({
    resolver: zodResolver(notificationSettingsSchema),
    defaultValues: {
      emailNotificationsEnabled: getSettingValue("notifications", "emailNotificationsEnabled", true),
      systemAlertsEnabled: getSettingValue("notifications", "systemAlertsEnabled", true),
      taskReminderEnabled: getSettingValue("notifications", "taskReminderEnabled", true),
      documentUploadNotifications: getSettingValue("notifications", "documentUploadNotifications", true),
      adminNotificationEmail: getSettingValue("notifications", "adminNotificationEmail", ""),
    },
  });

  const securityForm = useForm({
    resolver: zodResolver(securitySettingsSchema),
    defaultValues: {
      sessionTimeoutMinutes: getSettingValue("security", "sessionTimeoutMinutes", 60),
      requireStrongPasswords: getSettingValue("security", "requireStrongPasswords", true),
      maxFailedLogins: getSettingValue("security", "maxFailedLogins", 5),
      enableTwoFactor: getSettingValue("security", "enableTwoFactor", false),
      passwordMinLength: getSettingValue("security", "passwordMinLength", 8),
    },
  });

  const featureForm = useForm({
    resolver: zodResolver(featureSettingsSchema),
    defaultValues: {
      chatEnabled: getSettingValue("features", "chatEnabled", true),
      fileUploadsEnabled: getSettingValue("features", "fileUploadsEnabled", true),
      invitationsEnabled: getSettingValue("features", "invitationsEnabled", true),
      publicRegistration: getSettingValue("features", "publicRegistration", false),
      advancedWorkflowsEnabled: getSettingValue("features", "advancedWorkflowsEnabled", true),
    },
  });

  const integrationForm = useForm({
    resolver: zodResolver(integrationSettingsSchema),
    defaultValues: {
      parlantApiEnabled: getSettingValue("integrations", "parlantApiEnabled", true),
      emailServiceProvider: getSettingValue("integrations", "emailServiceProvider", "smtp"),
      objectStorageEnabled: getSettingValue("integrations", "objectStorageEnabled", true),
      analyticsEnabled: getSettingValue("integrations", "analyticsEnabled", false),
      backupEnabled: getSettingValue("integrations", "backupEnabled", true),
    },
  });

  const schedulerForm = useForm({
    resolver: zodResolver(schedulerSettingsSchema),
    defaultValues: {
      // US Code settings
      uscode_scheduler_enabled: getSettingValue("scheduler", "uscode_scheduler_enabled", true),
      uscode_scheduler_schedule: getSettingValue("scheduler", "uscode_scheduler_schedule", "0 2 * * *"),
      uscode_scheduler_incremental_enabled: getSettingValue("scheduler", "uscode_scheduler_incremental_enabled", true),
      uscode_scheduler_max_retries: getSettingValue("scheduler", "uscode_scheduler_max_retries", 3),
      uscode_scheduler_timeout_minutes: getSettingValue("scheduler", "uscode_scheduler_timeout_minutes", 60),
      uscode_scheduler_notify_on_failure: getSettingValue("scheduler", "uscode_scheduler_notify_on_failure", true),
      // UCC settings
      ucc_scheduler_enabled: getSettingValue("scheduler", "ucc_scheduler_enabled", true),
      ucc_scheduler_schedule: getSettingValue("scheduler", "ucc_scheduler_schedule", "30 2 * * *"),
      ucc_scheduler_incremental_enabled: getSettingValue("scheduler", "ucc_scheduler_incremental_enabled", true),
      ucc_scheduler_max_retries: getSettingValue("scheduler", "ucc_scheduler_max_retries", 3),
      ucc_scheduler_timeout_minutes: getSettingValue("scheduler", "ucc_scheduler_timeout_minutes", 120),
      ucc_scheduler_notify_on_failure: getSettingValue("scheduler", "ucc_scheduler_notify_on_failure", true),
      // Unified settings
      legal_scheduler_concurrent_execution: getSettingValue("scheduler", "legal_scheduler_concurrent_execution", false),
      legal_scheduler_resource_throttling: getSettingValue("scheduler", "legal_scheduler_resource_throttling", true),
    },
  });

  // Update mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: any[]) => {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ settings }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to update settings");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      setHasUnsavedChanges(false);
      toast({
        title: "Settings Updated",
        description: "System settings have been successfully updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update system settings",
        variant: "destructive",
      });
    },
  });

  // Helper function to convert form data to settings array
  const formDataToSettings = (formData: any, category: string) => {
    return Object.entries(formData).map(([key, value]) => ({
      key,
      value,
      category,
      description: getSettingDescription(key),
      isReadOnly: false,
    }));
  };

  // Get description for settings
  const getSettingDescription = (key: string): string => {
    const descriptions: Record<string, string> = {
      siteName: "The name of your family portal application",
      siteDescription: "A brief description of your family portal",
      maintenanceMode: "Temporarily disable the site for maintenance",
      supportEmail: "Email address for user support inquiries",
      maxFamilySize: "Maximum number of members allowed per family",
      emailNotificationsEnabled: "Enable email notifications for users",
      systemAlertsEnabled: "Enable system-wide alerts and announcements",
      taskReminderEnabled: "Send email reminders for pending tasks",
      documentUploadNotifications: "Notify when documents are uploaded",
      adminNotificationEmail: "Email address for administrative notifications",
      sessionTimeoutMinutes: "Minutes before user sessions expire",
      requireStrongPasswords: "Enforce strong password requirements",
      maxFailedLogins: "Maximum failed login attempts before lockout",
      enableTwoFactor: "Enable two-factor authentication (future feature)",
      passwordMinLength: "Minimum password length requirement",
      chatEnabled: "Enable AI chat functionality",
      fileUploadsEnabled: "Allow users to upload files and documents",
      invitationsEnabled: "Allow family members to invite others",
      publicRegistration: "Allow public user registration",
      advancedWorkflowsEnabled: "Enable advanced workflow automation",
      parlantApiEnabled: "Enable Parlant AI service integration",
      emailServiceProvider: "Email service provider configuration",
      objectStorageEnabled: "Enable cloud object storage",
      analyticsEnabled: "Enable usage analytics collection",
      backupEnabled: "Enable automatic data backups",
      // Scheduler settings descriptions
      uscode_scheduler_enabled: "Enable US Code automatic re-indexing",
      uscode_scheduler_schedule: "Cron schedule for US Code indexing (default: 2:00 AM daily)",
      uscode_scheduler_incremental_enabled: "Enable incremental US Code updates",
      uscode_scheduler_max_retries: "Maximum retry attempts for failed US Code indexing jobs",
      uscode_scheduler_timeout_minutes: "Timeout in minutes for US Code indexing operations",
      uscode_scheduler_notify_on_failure: "Send notifications when US Code indexing fails",
      ucc_scheduler_enabled: "Enable UCC automatic re-indexing",
      ucc_scheduler_schedule: "Cron schedule for UCC indexing (default: 2:30 AM daily)",
      ucc_scheduler_incremental_enabled: "Enable incremental UCC updates",
      ucc_scheduler_max_retries: "Maximum retry attempts for failed UCC indexing jobs",
      ucc_scheduler_timeout_minutes: "Timeout in minutes for UCC indexing operations",
      ucc_scheduler_notify_on_failure: "Send notifications when UCC indexing fails",
      legal_scheduler_concurrent_execution: "Allow US Code and UCC indexing to run concurrently",
      legal_scheduler_resource_throttling: "Enable resource throttling between legal content indexing jobs",
    };
    return descriptions[key] || "";
  };

  // Save handlers for each form
  const saveGeneralSettings = (data: z.infer<typeof generalSettingsSchema>) => {
    const settings = formDataToSettings(data, "general");
    updateSettingsMutation.mutate(settings);
  };

  const saveNotificationSettings = (data: z.infer<typeof notificationSettingsSchema>) => {
    const settings = formDataToSettings(data, "notifications");
    updateSettingsMutation.mutate(settings);
  };

  const saveSecuritySettings = (data: z.infer<typeof securitySettingsSchema>) => {
    const settings = formDataToSettings(data, "security");
    updateSettingsMutation.mutate(settings);
  };

  const saveFeatureSettings = (data: z.infer<typeof featureSettingsSchema>) => {
    const settings = formDataToSettings(data, "features");
    updateSettingsMutation.mutate(settings);
  };

  const saveIntegrationSettings = (data: z.infer<typeof integrationSettingsSchema>) => {
    const settings = formDataToSettings(data, "integrations");
    updateSettingsMutation.mutate(settings);
  };

  const saveSchedulerSettings = (data: z.infer<typeof schedulerSettingsSchema>) => {
    const settings = formDataToSettings(data, "scheduler");
    updateSettingsMutation.mutate(settings);
  };

  if (isLoading) {
    return (
      <PortalLayout pageTitle="System Settings">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading system settings...</p>
          </div>
        </div>
      </PortalLayout>
    );
  }

  if (error) {
    return (
      <PortalLayout pageTitle="System Settings">
        <Alert variant="destructive" data-testid="alert-settings-error">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load system settings. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout pageTitle="System Settings">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground" data-testid="text-settings-title">
              System Settings
            </h1>
            <p className="text-muted-foreground mt-2">
              Configure system-wide settings for the family portal
            </p>
          </div>
          {hasUnsavedChanges && (
            <Badge variant="secondary" data-testid="badge-unsaved-changes">
              <AlertTriangle className="w-4 h-4 mr-1" />
              Unsaved Changes
            </Badge>
          )}
        </div>

        {/* Maintenance Mode Alert */}
        {getSettingValue("general", "maintenanceMode", false) && (
          <Alert data-testid="alert-maintenance-mode">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Maintenance mode is currently enabled. The site is not accessible to regular users.
            </AlertDescription>
          </Alert>
        )}

        {/* Settings Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6" data-testid="tabs-settings-navigation">
            <TabsTrigger value="general" className="flex items-center space-x-2" data-testid="tab-general">
              <Settings className="w-4 h-4" />
              <span>General</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center space-x-2" data-testid="tab-notifications">
              <Bell className="w-4 h-4" />
              <span>Notifications</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center space-x-2" data-testid="tab-security">
              <Shield className="w-4 h-4" />
              <span>Security</span>
            </TabsTrigger>
            <TabsTrigger value="features" className="flex items-center space-x-2" data-testid="tab-features">
              <Zap className="w-4 h-4" />
              <span>Features</span>
            </TabsTrigger>
            <TabsTrigger value="integrations" className="flex items-center space-x-2" data-testid="tab-integrations">
              <Link className="w-4 h-4" />
              <span>Integrations</span>
            </TabsTrigger>
            <TabsTrigger value="scheduler" className="flex items-center space-x-2" data-testid="tab-scheduler">
              <Clock className="w-4 h-4" />
              <span>Scheduler</span>
            </TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general" className="space-y-6" data-testid="content-general">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>
                  Basic configuration options for your family portal
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...generalForm}>
                  <form onSubmit={generalForm.handleSubmit(saveGeneralSettings)} className="space-y-4">
                    <FormField
                      control={generalForm.control}
                      name="siteName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Site Name</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-site-name" />
                          </FormControl>
                          <FormDescription>
                            The name displayed in the browser title and header
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={generalForm.control}
                      name="siteDescription"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Site Description</FormLabel>
                          <FormControl>
                            <Textarea {...field} data-testid="textarea-site-description" />
                          </FormControl>
                          <FormDescription>
                            A brief description of your family portal
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={generalForm.control}
                      name="supportEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Support Email</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" data-testid="input-support-email" />
                          </FormControl>
                          <FormDescription>
                            Email address for user support inquiries
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={generalForm.control}
                      name="maxFamilySize"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Maximum Family Size</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="number" 
                              min="1" 
                              max="50"
                              onChange={e => field.onChange(parseInt(e.target.value))}
                              data-testid="input-max-family-size"
                            />
                          </FormControl>
                          <FormDescription>
                            Maximum number of members allowed per family
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={generalForm.control}
                      name="maintenanceMode"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Maintenance Mode</FormLabel>
                            <FormDescription>
                              Temporarily disable the site for maintenance
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-maintenance-mode"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <Button 
                      type="submit" 
                      disabled={updateSettingsMutation.isPending}
                      data-testid="button-save-general"
                    >
                      {updateSettingsMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save General Settings
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notification Settings */}
          <TabsContent value="notifications" className="space-y-6" data-testid="content-notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notification Settings</CardTitle>
                <CardDescription>
                  Configure email notifications and system alerts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...notificationForm}>
                  <form onSubmit={notificationForm.handleSubmit(saveNotificationSettings)} className="space-y-4">
                    <FormField
                      control={notificationForm.control}
                      name="adminNotificationEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Admin Notification Email</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" data-testid="input-admin-notification-email" />
                          </FormControl>
                          <FormDescription>
                            Email address for administrative notifications
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Separator />

                    <FormField
                      control={notificationForm.control}
                      name="emailNotificationsEnabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Email Notifications</FormLabel>
                            <FormDescription>
                              Enable email notifications for users
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-email-notifications"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={notificationForm.control}
                      name="systemAlertsEnabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">System Alerts</FormLabel>
                            <FormDescription>
                              Enable system-wide alerts and announcements
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-system-alerts"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={notificationForm.control}
                      name="taskReminderEnabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Task Reminders</FormLabel>
                            <FormDescription>
                              Send email reminders for pending tasks
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-task-reminders"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={notificationForm.control}
                      name="documentUploadNotifications"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Document Upload Notifications</FormLabel>
                            <FormDescription>
                              Notify when documents are uploaded or updated
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-document-notifications"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <Button 
                      type="submit" 
                      disabled={updateSettingsMutation.isPending}
                      data-testid="button-save-notifications"
                    >
                      {updateSettingsMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Notification Settings
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Settings */}
          <TabsContent value="security" className="space-y-6" data-testid="content-security">
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>
                  Configure security policies and authentication requirements
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...securityForm}>
                  <form onSubmit={securityForm.handleSubmit(saveSecuritySettings)} className="space-y-4">
                    <FormField
                      control={securityForm.control}
                      name="sessionTimeoutMinutes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Session Timeout (Minutes)</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="number" 
                              min="5" 
                              max="1440"
                              onChange={e => field.onChange(parseInt(e.target.value))}
                              data-testid="input-session-timeout"
                            />
                          </FormControl>
                          <FormDescription>
                            Minutes before user sessions expire (5-1440)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={securityForm.control}
                      name="passwordMinLength"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Minimum Password Length</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="number" 
                              min="6" 
                              max="32"
                              onChange={e => field.onChange(parseInt(e.target.value))}
                              data-testid="input-password-length"
                            />
                          </FormControl>
                          <FormDescription>
                            Minimum number of characters required for passwords
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={securityForm.control}
                      name="maxFailedLogins"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Maximum Failed Login Attempts</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="number" 
                              min="1" 
                              max="10"
                              onChange={e => field.onChange(parseInt(e.target.value))}
                              data-testid="input-max-failed-logins"
                            />
                          </FormControl>
                          <FormDescription>
                            Number of failed attempts before account lockout
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Separator />

                    <FormField
                      control={securityForm.control}
                      name="requireStrongPasswords"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Require Strong Passwords</FormLabel>
                            <FormDescription>
                              Enforce strong password requirements (uppercase, lowercase, numbers, symbols)
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-strong-passwords"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={securityForm.control}
                      name="enableTwoFactor"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Two-Factor Authentication</FormLabel>
                            <FormDescription>
                              Enable two-factor authentication for enhanced security (future feature)
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              disabled={true}
                              data-testid="switch-two-factor"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <Button 
                      type="submit" 
                      disabled={updateSettingsMutation.isPending}
                      data-testid="button-save-security"
                    >
                      {updateSettingsMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Security Settings
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Feature Settings */}
          <TabsContent value="features" className="space-y-6" data-testid="content-features">
            <Card>
              <CardHeader>
                <CardTitle>Feature Settings</CardTitle>
                <CardDescription>
                  Enable or disable features across the family portal
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...featureForm}>
                  <form onSubmit={featureForm.handleSubmit(saveFeatureSettings)} className="space-y-4">
                    <FormField
                      control={featureForm.control}
                      name="chatEnabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">AI Chat</FormLabel>
                            <FormDescription>
                              Enable AI chat functionality for users
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-chat-enabled"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={featureForm.control}
                      name="fileUploadsEnabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">File Uploads</FormLabel>
                            <FormDescription>
                              Allow users to upload files and documents
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-file-uploads"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={featureForm.control}
                      name="invitationsEnabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Family Invitations</FormLabel>
                            <FormDescription>
                              Allow family members to invite others to join
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-invitations"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={featureForm.control}
                      name="publicRegistration"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Public Registration</FormLabel>
                            <FormDescription>
                              Allow public user registration without invitations
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-public-registration"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={featureForm.control}
                      name="advancedWorkflowsEnabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Advanced Workflows</FormLabel>
                            <FormDescription>
                              Enable advanced workflow automation and rules
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-advanced-workflows"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <Button 
                      type="submit" 
                      disabled={updateSettingsMutation.isPending}
                      data-testid="button-save-features"
                    >
                      {updateSettingsMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Feature Settings
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Integration Settings */}
          <TabsContent value="integrations" className="space-y-6" data-testid="content-integrations">
            <Card>
              <CardHeader>
                <CardTitle>Integration Settings</CardTitle>
                <CardDescription>
                  Configure external service integrations and system components
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...integrationForm}>
                  <form onSubmit={integrationForm.handleSubmit(saveIntegrationSettings)} className="space-y-4">
                    <FormField
                      control={integrationForm.control}
                      name="emailServiceProvider"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Service Provider</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-email-provider" />
                          </FormControl>
                          <FormDescription>
                            Current email service provider configuration
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Separator />

                    <FormField
                      control={integrationForm.control}
                      name="parlantApiEnabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Parlant AI Service</FormLabel>
                            <FormDescription>
                              Enable Parlant AI service integration for chat functionality
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-parlant-api"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={integrationForm.control}
                      name="objectStorageEnabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Object Storage</FormLabel>
                            <FormDescription>
                              Enable cloud object storage for file uploads
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-object-storage"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={integrationForm.control}
                      name="analyticsEnabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Usage Analytics</FormLabel>
                            <FormDescription>
                              Enable usage analytics collection for insights
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-analytics"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={integrationForm.control}
                      name="backupEnabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Automatic Backups</FormLabel>
                            <FormDescription>
                              Enable automatic data backups and recovery
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-backups"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <Button 
                      type="submit" 
                      disabled={updateSettingsMutation.isPending}
                      data-testid="button-save-integrations"
                    >
                      {updateSettingsMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Integration Settings
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Scheduler Settings */}
          <TabsContent value="scheduler" className="space-y-6" data-testid="content-scheduler">
            <Card>
              <CardHeader>
                <CardTitle>Legal Content Scheduler</CardTitle>
                <CardDescription>
                  Configure automatic indexing schedules for US Code and UCC content
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...schedulerForm}>
                  <form onSubmit={schedulerForm.handleSubmit(saveSchedulerSettings)} className="space-y-6">
                    
                    {/* US Code Settings Section */}
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <h3 className="text-lg font-semibold">US Code Indexing</h3>
                        <Badge variant="outline">Legacy System</Badge>
                      </div>
                      
                      <FormField
                        control={schedulerForm.control}
                        name="uscode_scheduler_enabled"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Enable US Code Indexing</FormLabel>
                              <FormDescription>
                                Enable automatic US Code re-indexing on schedule
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-uscode-enabled"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={schedulerForm.control}
                          name="uscode_scheduler_schedule"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>US Code Schedule</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="0 2 * * *" data-testid="input-uscode-schedule" />
                              </FormControl>
                              <FormDescription>
                                Cron expression for US Code indexing (2:00 AM daily)
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={schedulerForm.control}
                          name="uscode_scheduler_timeout_minutes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>US Code Timeout (minutes)</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  type="number" 
                                  min="5" 
                                  max="300"
                                  onChange={e => field.onChange(parseInt(e.target.value))}
                                  data-testid="input-uscode-timeout"
                                />
                              </FormControl>
                              <FormDescription>
                                Timeout for US Code indexing operations
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={schedulerForm.control}
                          name="uscode_scheduler_max_retries"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>US Code Max Retries</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  type="number" 
                                  min="1" 
                                  max="10"
                                  onChange={e => field.onChange(parseInt(e.target.value))}
                                  data-testid="input-uscode-retries"
                                />
                              </FormControl>
                              <FormDescription>
                                Maximum retry attempts for failed US Code jobs
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={schedulerForm.control}
                          name="uscode_scheduler_incremental_enabled"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">Incremental Updates</FormLabel>
                                <FormDescription>
                                  Enable incremental US Code updates
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  data-testid="switch-uscode-incremental"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={schedulerForm.control}
                        name="uscode_scheduler_notify_on_failure"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">US Code Failure Notifications</FormLabel>
                              <FormDescription>
                                Send notifications when US Code indexing fails
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-uscode-notifications"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <Separator />

                    {/* UCC Settings Section */}
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <h3 className="text-lg font-semibold">UCC Indexing</h3>
                        <Badge variant="secondary">Commercial Law</Badge>
                      </div>
                      
                      <FormField
                        control={schedulerForm.control}
                        name="ucc_scheduler_enabled"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Enable UCC Indexing</FormLabel>
                              <FormDescription>
                                Enable automatic UCC re-indexing on schedule
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-ucc-enabled"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={schedulerForm.control}
                          name="ucc_scheduler_schedule"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>UCC Schedule</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="30 2 * * *" data-testid="input-ucc-schedule" />
                              </FormControl>
                              <FormDescription>
                                Cron expression for UCC indexing (2:30 AM daily)
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={schedulerForm.control}
                          name="ucc_scheduler_timeout_minutes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>UCC Timeout (minutes)</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  type="number" 
                                  min="5" 
                                  max="300"
                                  onChange={e => field.onChange(parseInt(e.target.value))}
                                  data-testid="input-ucc-timeout"
                                />
                              </FormControl>
                              <FormDescription>
                                Timeout for UCC indexing operations
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={schedulerForm.control}
                          name="ucc_scheduler_max_retries"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>UCC Max Retries</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  type="number" 
                                  min="1" 
                                  max="10"
                                  onChange={e => field.onChange(parseInt(e.target.value))}
                                  data-testid="input-ucc-retries"
                                />
                              </FormControl>
                              <FormDescription>
                                Maximum retry attempts for failed UCC jobs
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={schedulerForm.control}
                          name="ucc_scheduler_incremental_enabled"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">Incremental Updates</FormLabel>
                                <FormDescription>
                                  Enable incremental UCC updates
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  data-testid="switch-ucc-incremental"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={schedulerForm.control}
                        name="ucc_scheduler_notify_on_failure"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">UCC Failure Notifications</FormLabel>
                              <FormDescription>
                                Send notifications when UCC indexing fails
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-ucc-notifications"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <Separator />

                    {/* Unified Settings Section */}
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <h3 className="text-lg font-semibold">Unified Scheduler Settings</h3>
                        <Badge variant="default">Advanced</Badge>
                      </div>
                      
                      <FormField
                        control={schedulerForm.control}
                        name="legal_scheduler_concurrent_execution"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Concurrent Execution</FormLabel>
                              <FormDescription>
                                Allow US Code and UCC indexing to run simultaneously
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-concurrent-execution"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={schedulerForm.control}
                        name="legal_scheduler_resource_throttling"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Resource Throttling</FormLabel>
                              <FormDescription>
                                Enable resource throttling between indexing jobs
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-resource-throttling"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button 
                      type="submit" 
                      disabled={updateSettingsMutation.isPending}
                      data-testid="button-save-scheduler"
                    >
                      {updateSettingsMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Scheduler Settings
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PortalLayout>
  );
}