import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { 
  authenticateWithRole, 
  authenticateAdmin, 
  authenticateFamily,
  requirePermission,
  requireAdmin,
  loadUserRole,
  type AuthenticatedRequest 
} from "./rbacMiddleware";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { insertFamilySchema, insertTaskSchema, insertMessageSchema, insertInvitationSchema, insertNotificationPreferencesSchema, insertTaskDependencySchema, insertWorkflowRuleSchema, insertSystemSettingsSchema, insertUccArticleSchema, insertUccPartSchema, insertUccSectionSchema, insertUccSubsectionSchema, insertUccDefinitionSchema, insertUccCrossReferenceSchema, insertUccSearchIndexSchema, users, invitations, workflowRules } from "@shared/schema";
import { Permission, hasPermission, getEnabledFeatures, getRolePermissions, isAdmin } from "@shared/permissions";
import { notificationService } from "./email/notificationService";
import { eventBus } from "./automation/EventBus";
import { getAutomationHealth, checkFamilyDependencies } from "./automation/index";
import { validateTaskTransition, getDependencyTaskNames, type TaskStatus } from "./taskValidation";
import multer from "multer";
import { nanoid } from "nanoid";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import axios from "axios";
import { spawn } from "child_process";
import { migrateAdminUsers, verifyMigration } from "./migration";

// TypeScript interfaces for AI chat service
interface ChatRequest {
  message: string;
  session_id?: string;
  context?: {
    user_role?: string;
    family_id?: string;
    current_page?: string;
    [key: string]: any;
  };
}

interface ChatResponse {
  response: string;
  session_id: string;
  success: boolean;
  error?: string;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Initialize default tasks if they don't exist
  await initializeDefaultTasks();

  // Initialize default scheduler settings
  await initializeSchedulerSettings();

  // Start Parlant service integration
  await initializeParlantService();

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, loadUserRole, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Include family information if user is part of a family
      let familyInfo = null;
      if (user.familyId) {
        const family = await storage.getFamilyWithMembers(user.familyId);
        familyInfo = family;
      }

      // Include role-based permissions and features
      const userRole = req.userRole!;
      const permissions = getRolePermissions(userRole);
      const enabledFeatures = getEnabledFeatures(userRole);

      res.json({
        ...user,
        family: familyInfo,
        permissions,
        enabledFeatures,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Family authentication endpoint
  app.post('/api/auth/family', async (req, res) => {
    try {
      const { familyCode } = req.body;
      
      if (!familyCode) {
        return res.status(400).json({ message: "Family code is required" });
      }

      const family = await storage.getFamilyByCode(familyCode);
      if (!family) {
        return res.status(401).json({ message: "Invalid family code" });
      }

      res.json({ family });
    } catch (error) {
      console.error("Error authenticating family:", error);
      res.status(500).json({ message: "Authentication failed" });
    }
  });

  // Family endpoints
  app.get('/api/families', isAuthenticated, loadUserRole, requirePermission(Permission.VIEW_ALL_FAMILIES), async (req: AuthenticatedRequest, res) => {
    try {
      const families = await storage.getAllFamilies();
      
      // Get stats for each family
      const familiesWithStats = await Promise.all(
        families.map(async (family) => {
          const stats = await storage.getFamilyStats(family.id);
          return {
            ...family,
            stats,
          };
        })
      );

      res.json(familiesWithStats);
    } catch (error) {
      console.error("Error fetching families:", error);
      res.status(500).json({ message: "Failed to fetch families" });
    }
  });

  app.post('/api/families', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_ALL_FAMILIES), async (req: AuthenticatedRequest, res) => {
    try {

      const familyData = insertFamilySchema.parse(req.body);
      const family = await storage.createFamily(familyData);
      
      // Initialize tasks for the new family
      await storage.initializeFamilyTasks(family.id);

      res.status(201).json(family);
    } catch (error) {
      console.error("Error creating family:", error);
      res.status(500).json({ message: "Failed to create family" });
    }
  });

  // Get individual family with members (admin only)
  app.get('/api/families/:familyId', isAuthenticated, loadUserRole, requirePermission(Permission.VIEW_ALL_FAMILIES), async (req: AuthenticatedRequest, res) => {
    try {
      const { familyId } = req.params;

      const family = await storage.getFamilyWithMembers(familyId);
      if (!family) {
        return res.status(404).json({ message: "Family not found" });
      }

      res.json(family);
    } catch (error) {
      console.error("Error fetching family:", error);
      res.status(500).json({ message: "Failed to fetch family" });
    }
  });

  // Join family endpoint
  app.post('/api/families/join', isAuthenticated, async (req: any, res) => {
    try {
      const { familyCode } = req.body;
      const userId = req.user.claims.sub;
      
      if (!familyCode) {
        return res.status(400).json({ message: "Family code is required" });
      }

      const family = await storage.getFamilyByCode(familyCode);
      if (!family) {
        return res.status(404).json({ message: "Invalid family code" });
      }

      // Update user to join the family
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      await storage.upsertUser({
        ...user,
        familyId: family.id,
        role: 'family'
      });

      res.json({ message: "Successfully joined family", family });
    } catch (error) {
      console.error("Error joining family:", error);
      res.status(500).json({ message: "Failed to join family" });
    }
  });

  // Admin automation health endpoint
  app.get('/api/admin/automation/health', isAuthenticated, loadUserRole, requirePermission(Permission.VIEW_ADMIN_DASHBOARD), async (req: AuthenticatedRequest, res) => {
    try {

      const health = getAutomationHealth();
      res.json(health);
    } catch (error) {
      console.error("Error fetching automation health:", error);
      res.status(500).json({ message: "Failed to fetch automation health" });
    }
  });

  // Admin manual dependency check endpoint
  app.post('/api/admin/automation/check-dependencies', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_DEPENDENCIES), async (req: AuthenticatedRequest, res) => {
    try {
      const { familyId } = req.body;

      if (!familyId) {
        return res.status(400).json({ message: "Family ID is required" });
      }

      const result = await checkFamilyDependencies(familyId);
      res.json(result);
    } catch (error) {
      console.error("Error in manual dependency check:", error);
      res.status(500).json({ message: "Failed to check dependencies" });
    }
  });

  // Admin users endpoint for user management
  app.get('/api/admin/users', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_USERS), async (req: AuthenticatedRequest, res) => {
    try {
      // Get all users from database
      const allUsers = await storage.getAllUsers();
      
      // Format user data for the management table
      const userData = allUsers.map(user => {
        // Get family name if user belongs to one
        let familyName = null;
        if (user.familyId) {
          // We could populate this later if needed, for now keep it simple
          familyName = user.familyId;
        }
        
        return {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          familyId: user.familyId,
          familyName: familyName,
          profileImageUrl: user.profileImageUrl,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          displayName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User'
        };
      });
      
      res.json(userData);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Admin setup endpoint
  app.post('/api/admin/setup', async (req, res) => {
    try {
      const { adminEmail, setupKey } = req.body;
      
      // Simple setup key check - in production this would be more secure
      if (setupKey !== 'admin-setup-2024') {
        return res.status(403).json({ message: "Invalid setup key" });
      }

      // Check if any admins exist
      const existingAdmins = await storage.getAdminUsers();
      if (existingAdmins.length > 0) {
        return res.status(400).json({ message: "Admin already exists" });
      }

      // This endpoint allows setting up the first admin
      // The actual user creation will happen via Replit Auth
      res.json({ message: "Admin setup ready", adminEmail });
    } catch (error) {
      console.error("Error in admin setup:", error);
      res.status(500).json({ message: "Admin setup failed" });
    }
  });

  // ==================== ADMIN DEPENDENCY MANAGEMENT ENDPOINTS ====================
  
  // Get all task dependencies
  app.get('/api/admin/dependencies', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_DEPENDENCIES), async (req: AuthenticatedRequest, res) => {
    try {

      const allTasks = await storage.getAllTasks();
      const taskMap = new Map(allTasks.map(task => [task.id, task]));
      
      // Get all dependencies with task information
      const dependencies = [];
      for (const task of allTasks) {
        const taskDeps = await storage.getTaskDependencies(task.id);
        for (const dep of taskDeps) {
          dependencies.push({
            id: dep.id,
            taskId: dep.taskId,
            taskName: taskMap.get(dep.taskId)?.title || 'Unknown Task',
            dependsOnTaskId: dep.dependsOnTaskId,
            dependsOnTaskName: taskMap.get(dep.dependsOnTaskId)?.title || 'Unknown Task',
            dependencyType: dep.dependencyType,
            createdAt: dep.createdAt,
          });
        }
      }

      res.json(dependencies);
    } catch (error) {
      console.error("Error fetching dependencies:", error);
      res.status(500).json({ message: "Failed to fetch dependencies" });
    }
  });

  // Create new task dependency
  app.post('/api/admin/dependencies', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_DEPENDENCIES), async (req: AuthenticatedRequest, res) => {
    try {

      const dependencyData = insertTaskDependencySchema.parse(req.body);
      const dependency = await storage.addTaskDependency(dependencyData);
      
      // Return dependency with task names for UI
      const allTasks = await storage.getAllTasks();
      const taskMap = new Map(allTasks.map(task => [task.id, task]));
      
      const dependencyWithNames = {
        ...dependency,
        taskName: taskMap.get(dependency.taskId)?.title || 'Unknown Task',
        dependsOnTaskName: taskMap.get(dependency.dependsOnTaskId)?.title || 'Unknown Task',
      };

      res.status(201).json(dependencyWithNames);
    } catch (error) {
      console.error("Error creating dependency:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to create dependency";
      res.status(400).json({ message: errorMessage });
    }
  });

  // Update task dependency
  app.put('/api/admin/dependencies/:id', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_DEPENDENCIES), async (req: AuthenticatedRequest, res) => {
    try {

      const { id } = req.params;
      const updateData = insertTaskDependencySchema.parse(req.body);
      
      // Transaction-safe update: verify dependency exists, then update atomically
      // First find the existing dependency to ensure it exists
      const allTasks = await storage.getAllTasks();
      const dependencies = [];
      for (const task of allTasks) {
        const taskDeps = await storage.getTaskDependencies(task.id);
        dependencies.push(...taskDeps);
      }
      
      const existingDep = dependencies.find(dep => dep.id === id);
      if (!existingDep) {
        return res.status(404).json({ message: "Dependency not found" });
      }

      // SAFE ORDER: Add new dependency first, then remove old one to prevent data loss
      let newDependency;
      try {
        newDependency = await storage.addTaskDependency(updateData);
        // Only remove old dependency if new one was successfully added
        await storage.removeTaskDependency(existingDep.taskId, existingDep.dependsOnTaskId, existingDep.dependencyType);
      } catch (addError) {
        // If adding new dependency fails, the original remains intact
        const errorMessage = addError instanceof Error ? addError.message : 'Unknown error';
        throw new Error(`Failed to update dependency: ${errorMessage}`);
      }

      // Return dependency with task names for UI
      const allTasksForUI = await storage.getAllTasks();
      const taskMap = new Map(allTasksForUI.map(task => [task.id, task]));
      
      const dependencyWithNames = {
        ...newDependency,
        taskName: taskMap.get(newDependency.taskId)?.title || 'Unknown Task',
        dependsOnTaskName: taskMap.get(newDependency.dependsOnTaskId)?.title || 'Unknown Task',
      };

      res.json(dependencyWithNames);
    } catch (error) {
      console.error("Error updating dependency:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to update dependency";
      res.status(400).json({ message: errorMessage });
    }
  });

  // Delete task dependency
  app.delete('/api/admin/dependencies/:id', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_DEPENDENCIES), async (req: AuthenticatedRequest, res) => {
    try {

      const { id } = req.params;
      
      // Find the dependency to get its details for deletion
      const allTasks = await storage.getAllTasks();
      let dependencyToDelete = null;
      
      for (const task of allTasks) {
        const taskDeps = await storage.getTaskDependencies(task.id);
        dependencyToDelete = taskDeps.find(dep => dep.id === id);
        if (dependencyToDelete) break;
      }

      if (!dependencyToDelete) {
        return res.status(404).json({ message: "Dependency not found" });
      }

      await storage.removeTaskDependency(
        dependencyToDelete.taskId, 
        dependencyToDelete.dependsOnTaskId, 
        dependencyToDelete.dependencyType
      );

      res.json({ message: "Dependency deleted successfully" });
    } catch (error) {
      console.error("Error deleting dependency:", error);
      res.status(500).json({ message: "Failed to delete dependency" });
    }
  });

  // ==================== ADMIN WORKFLOW RULES MANAGEMENT ENDPOINTS ====================
  
  // Get all workflow rules
  app.get('/api/admin/workflow-rules', isAuthenticated, loadUserRole, requirePermission(Permission.MODIFY_WORKFLOW_RULES), async (req: AuthenticatedRequest, res) => {
    try {

      const rules = await storage.getActiveWorkflowRules();
      const allTasks = await storage.getAllTasks();
      const taskMap = new Map(allTasks.map(task => [task.id, task]));
      
      // Add task names to rules for better UI
      const rulesWithNames = rules.map(rule => ({
        ...rule,
        triggerTaskName: rule.triggerTaskId ? taskMap.get(rule.triggerTaskId)?.title : undefined,
        actionTargetTaskName: rule.actionTargetTaskId ? taskMap.get(rule.actionTargetTaskId)?.title : undefined,
      }));

      res.json(rulesWithNames);
    } catch (error) {
      console.error("Error fetching workflow rules:", error);
      res.status(500).json({ message: "Failed to fetch workflow rules" });
    }
  });

  // Create new workflow rule
  app.post('/api/admin/workflow-rules', isAuthenticated, loadUserRole, requirePermission(Permission.MODIFY_WORKFLOW_RULES), async (req: AuthenticatedRequest, res) => {
    try {

      const ruleData = insertWorkflowRuleSchema.parse(req.body);
      const rule = await storage.addWorkflowRule(ruleData);
      
      // Return rule with task names for UI
      const allTasks = await storage.getAllTasks();
      const taskMap = new Map(allTasks.map(task => [task.id, task]));
      
      const ruleWithNames = {
        ...rule,
        triggerTaskName: rule.triggerTaskId ? taskMap.get(rule.triggerTaskId)?.title : undefined,
        actionTargetTaskName: rule.actionTargetTaskId ? taskMap.get(rule.actionTargetTaskId)?.title : undefined,
      };

      res.status(201).json(ruleWithNames);
    } catch (error) {
      console.error("Error creating workflow rule:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to create workflow rule";
      res.status(400).json({ message: errorMessage });
    }
  });

  // Update workflow rule
  app.put('/api/admin/workflow-rules/:id', isAuthenticated, loadUserRole, requirePermission(Permission.MODIFY_WORKFLOW_RULES), async (req: AuthenticatedRequest, res) => {
    try {

      const { id } = req.params;
      const updateData = insertWorkflowRuleSchema.parse(req.body);
      
      // For workflow rules, we'll implement a direct update in storage
      // For now, let's implement it by recreating (like dependencies)
      const updatedRule = await storage.addWorkflowRule(updateData);
      
      // Return rule with task names for UI
      const allTasks = await storage.getAllTasks();
      const taskMap = new Map(allTasks.map(task => [task.id, task]));
      
      const ruleWithNames = {
        ...updatedRule,
        triggerTaskName: updatedRule.triggerTaskId ? taskMap.get(updatedRule.triggerTaskId)?.title : undefined,
        actionTargetTaskName: updatedRule.actionTargetTaskId ? taskMap.get(updatedRule.actionTargetTaskId)?.title : undefined,
      };

      res.json(ruleWithNames);
    } catch (error) {
      console.error("Error updating workflow rule:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to update workflow rule";
      res.status(400).json({ message: errorMessage });
    }
  });

  // Delete workflow rule
  app.delete('/api/admin/workflow-rules/:id', isAuthenticated, loadUserRole, requirePermission(Permission.MODIFY_WORKFLOW_RULES), async (req: AuthenticatedRequest, res) => {
    try {

      const { id } = req.params;
      
      // Delete workflow rule from database
      await db.delete(workflowRules).where(eq(workflowRules.id, id));

      res.json({ message: "Workflow rule deleted successfully" });
    } catch (error) {
      console.error("Error deleting workflow rule:", error);
      res.status(500).json({ message: "Failed to delete workflow rule" });
    }
  });

  // ==================== AI CHAT SERVICE PROXY ====================
  
  // AI Chat proxy endpoint - forwards requests to Parlant service
  app.post('/api/ai/chat', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const chatRequest: ChatRequest = {
        message: req.body.message,
        session_id: req.body.session_id,
        context: {
          user_role: user.role,
          family_id: user.familyId,
          current_page: req.body.context?.current_page,
          user_id: user.id,
          user_name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
          ...req.body.context
        }
      };

      // Validate required fields
      if (!chatRequest.message || typeof chatRequest.message !== 'string') {
        return res.status(400).json({ 
          success: false,
          error: "Message is required and must be a string" 
        });
      }

      // Get Parlant service configuration
      const parlantPort = process.env.PARLANT_PORT || '8800';
      const parlantHost = '127.0.0.1'; // Localhost only for security
      const parlantSecret = process.env.PARLANT_SHARED_SECRET || 'default-secret-key';
      const parlantUrl = `http://${parlantHost}:${parlantPort}/api/chat`;

      console.log(`Forwarding chat request to Parlant service at ${parlantUrl}`);

      // Forward request to Parlant service with authentication
      const response = await axios.post<ChatResponse>(parlantUrl, chatRequest, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${parlantSecret}`
        },
        timeout: 30000, // 30 second timeout
        validateStatus: (status) => status < 500 // Don't throw on 4xx errors
      });

      // Check if Parlant service returned an error
      if (response.status >= 400) {
        console.error(`Parlant service error: ${response.status}`, response.data);
        return res.status(response.status).json({
          success: false,
          error: "AI service temporarily unavailable",
          response: "I'm sorry, I'm having trouble processing your request right now. Please try again in a moment, or contact an administrator if the issue persists.",
          session_id: chatRequest.session_id || 'error'
        });
      }

      // Return successful response
      res.json(response.data);

    } catch (error: any) {
      console.error('AI Chat proxy error:', error.message);
      
      // Handle different types of errors
      if (error.code === 'ECONNREFUSED') {
        return res.status(503).json({
          success: false,
          error: "AI service unavailable",
          response: "I'm sorry, the AI assistant is currently unavailable. Please try again later or contact an administrator for help.",
          session_id: req.body.session_id || 'error'
        });
      }
      
      if (error.code === 'ETIMEDOUT') {
        return res.status(504).json({
          success: false,
          error: "AI service timeout",
          response: "I'm sorry, your request is taking too long to process. Please try asking a simpler question or contact an administrator.",
          session_id: req.body.session_id || 'error'
        });
      }

      // Generic error response
      res.status(500).json({
        success: false,
        error: "Internal server error",
        response: "I'm sorry, something went wrong while processing your request. Please try again or contact an administrator if the issue persists.",
        session_id: req.body.session_id || 'error'
      });
    }
  });

  // AI Chat health check endpoint
  app.get('/api/ai/health', isAuthenticated, loadUserRole, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {

      const parlantPort = process.env.PARLANT_PORT || '8800';
      const parlantHost = '127.0.0.1';
      const parlantUrl = `http://${parlantHost}:${parlantPort}/health`;

      const response = await axios.get(parlantUrl, { timeout: 5000 });
      res.json({
        status: 'healthy',
        parlant_service: response.data,
        proxy_status: 'operational'
      });
    } catch (error: any) {
      res.status(503).json({
        status: 'unhealthy',
        error: error.message,
        proxy_status: 'operational',
        parlant_service: 'unavailable'
      });
    }
  });

  // Toggle workflow rule active status
  app.patch('/api/admin/workflow-rules/:id/toggle', isAuthenticated, loadUserRole, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {

      const { id } = req.params;
      const { isActive } = req.body;
      
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ message: "isActive must be a boolean" });
      }

      const updatedRule = await storage.toggleWorkflowRule(id, isActive);
      
      // Return rule with task names for UI
      const allTasks = await storage.getAllTasks();
      const taskMap = new Map(allTasks.map(task => [task.id, task]));
      
      const ruleWithNames = {
        ...updatedRule,
        triggerTaskName: updatedRule.triggerTaskId ? taskMap.get(updatedRule.triggerTaskId)?.title : undefined,
        actionTargetTaskName: updatedRule.actionTargetTaskId ? taskMap.get(updatedRule.actionTargetTaskId)?.title : undefined,
      };

      res.json(ruleWithNames);
    } catch (error) {
      console.error("Error toggling workflow rule:", error);
      res.status(500).json({ message: "Failed to toggle workflow rule" });
    }
  });

  // System Settings endpoints
  app.get('/api/admin/settings', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_SYSTEM_SETTINGS), async (req: AuthenticatedRequest, res) => {
    try {
      const settings = await storage.getSystemSettings();
      
      // Group settings by category for easier frontend consumption
      const groupedSettings = settings.reduce((acc, setting) => {
        if (!acc[setting.category]) {
          acc[setting.category] = [];
        }
        acc[setting.category].push(setting);
        return acc;
      }, {} as Record<string, typeof settings>);

      res.json(groupedSettings);
    } catch (error) {
      console.error("Error fetching system settings:", error);
      res.status(500).json({ message: "Failed to fetch system settings" });
    }
  });

  app.put('/api/admin/settings', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_SYSTEM_SETTINGS), async (req: AuthenticatedRequest, res) => {
    try {
      const { settings } = req.body;
      
      if (!settings || !Array.isArray(settings)) {
        return res.status(400).json({ message: "Settings must be an array" });
      }

      // Validate and update each setting
      const updatedSettings = [];
      for (const setting of settings) {
        try {
          const validatedSetting = insertSystemSettingsSchema.parse(setting);
          const updated = await storage.upsertSystemSetting(validatedSetting);
          updatedSettings.push(updated);
        } catch (validationError) {
          console.error("Invalid setting:", setting, validationError);
          return res.status(400).json({ 
            message: `Invalid setting: ${setting.key}`,
            error: validationError
          });
        }
      }

      // Return grouped settings
      const allSettings = await storage.getSystemSettings();
      const groupedSettings = allSettings.reduce((acc, setting) => {
        if (!acc[setting.category]) {
          acc[setting.category] = [];
        }
        acc[setting.category].push(setting);
        return acc;
      }, {} as Record<string, typeof allSettings>);

      res.json(groupedSettings);
    } catch (error) {
      console.error("Error updating system settings:", error);
      res.status(500).json({ message: "Failed to update system settings" });
    }
  });

  // Individual system setting endpoint
  app.put('/api/admin/settings/:key', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_SYSTEM_SETTINGS), async (req: AuthenticatedRequest, res) => {
    try {
      const { key } = req.params;
      const { value } = req.body;

      if (value === undefined) {
        return res.status(400).json({ message: "Value is required" });
      }

      const updatedSetting = await storage.updateSystemSetting(key, value);
      res.json(updatedSetting);
    } catch (error) {
      console.error("Error updating system setting:", error);
      if (error instanceof Error && error.message.includes("not found")) {
        res.status(404).json({ message: "Setting not found" });
      } else {
        res.status(500).json({ message: "Failed to update system setting" });
      }
    }
  });

  // Task endpoints
  app.get('/api/tasks', isAuthenticated, loadUserRole, async (req: AuthenticatedRequest, res) => {
    try {
      const { familyId } = req.query;
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // If familyId is provided, admin can get tasks for any family
      if (familyId && isAdmin(req.userRole!)) {
        const familyTasks = await storage.getFamilyTasksWithDependencies(familyId as string);
        res.json(familyTasks);
      } else if (user.familyId) {
        // Family member - get family tasks with dependency information
        const familyTasks = await storage.getFamilyTasksWithDependencies(user.familyId);
        res.json(familyTasks);
      } else if (isAdmin(req.userRole!)) {
        // Admin - get template tasks (no specific family)
        const tasks = await storage.getAllTasks();
        res.json(tasks);
      } else {
        return res.status(403).json({ message: "Access denied" });
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.put('/api/tasks/:taskId/status', isAuthenticated, loadUserRole, async (req: AuthenticatedRequest, res) => {
    try {
      const { taskId } = req.params;
      const { status, notes } = req.body;
      
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // SECURITY: Verify task ownership before allowing updates
      const familyTask = await storage.getFamilyTask(taskId);
      if (!familyTask) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Allow admins to update any task, family members can only update their family's tasks
      if (!isAdmin(req.userRole!) && user.familyId !== familyTask.familyId) {
        return res.status(403).json({ message: "Access denied - task does not belong to your family" });
      }

      // Store the old status for validation and notification  
      const oldStatus = familyTask.status as TaskStatus;
      const newStatus = status as TaskStatus;

      // SECURITY: Always validate HTTP requests - no client bypass allowed
      const validation = await validateTaskTransition(
        taskId,
        oldStatus,
        newStatus,
        familyTask.familyId,
        false // Never bypass validation for HTTP requests
      );

      if (!validation.isValid) {
        // Get user-friendly names for incomplete dependencies
        let dependencyNames: string[] = [];
        if (validation.incompleteDependencies && validation.incompleteDependencies.length > 0) {
          dependencyNames = await getDependencyTaskNames(validation.incompleteDependencies);
        }

        return res.status(400).json({
          error: "Invalid task transition",
          message: validation.errorMessage,
          details: {
            ...validation.details,
            incompleteDependencyNames: dependencyNames
          }
        });
      }
      
      const updatedTask = await storage.updateFamilyTaskStatus(taskId, status, notes);
      
      // Emit automation event if status changed
      if (oldStatus !== status) {
        const correlationId = eventBus.generateCorrelationId();
        
        // Emit TaskStatusChanged event for automation processing
        eventBus.emitTaskStatusChanged({
          familyId: familyTask.familyId,
          familyTaskId: taskId,
          templateTaskId: familyTask.taskId,
          oldStatus: oldStatus,
          newStatus: status,
          actorUserId: user.id,
          correlationId: correlationId,
          timestamp: new Date(),
          notes: notes
        });

        // If completed, also emit TaskCompleted for specific handling  
        if (status === "completed") {
          eventBus.emitTaskCompleted({
            familyId: familyTask.familyId,
            familyTaskId: taskId,
            templateTaskId: familyTask.taskId,
            actorUserId: user.id,
            correlationId: correlationId,
            timestamp: new Date(),
            completedAt: updatedTask.completedAt || new Date()
          });
        }
      }
      
      // Send notification if status changed and we have all necessary data
      if (oldStatus !== status) {
        try {
          // Get family and complete task data for notification
          const family = await storage.getFamily(familyTask.familyId);
          const familyTaskWithTask = await storage.getFamilyTaskWithTask(taskId);
          
          if (family && familyTaskWithTask) {
            await notificationService.queueTaskStatusChange(
              familyTaskWithTask,
              family,
              user,
              oldStatus
            );
          }
        } catch (notificationError) {
          console.error("Error sending task status change notification:", notificationError);
          // Don't fail the request if notification fails
        }
      }
      
      res.json(updatedTask);
    } catch (error) {
      console.error("Error updating task status:", error);
      res.status(500).json({ message: "Failed to update task status" });
    }
  });

  // Document endpoints
  app.get('/api/documents', isAuthenticated, loadUserRole, async (req: AuthenticatedRequest, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      let familyId = user.familyId;
      
      // If admin and familyId query param provided, use that
      if (isAdmin(req.userRole!) && req.query.familyId) {
        familyId = req.query.familyId;
      }

      if (!familyId) {
        return res.status(400).json({ message: "Family ID required" });
      }

      const documents = await storage.getFamilyDocuments(familyId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  // Object storage endpoints for protected file serving
  app.get("/objects/:objectPath(*)", isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    const objectStorageService = new ObjectStorageService();
    
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });
      
      if (!canAccess) {
        return res.sendStatus(403);
      }
      
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error accessing object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", isAuthenticated, async (req: any, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });

  // Document upload completion endpoint
  app.post("/api/documents", isAuthenticated, loadUserRole, async (req: AuthenticatedRequest, res) => {
    try {
      const { fileName, originalFileName, fileSize, mimeType, uploadURL, familyTaskId } = req.body;
      
      if (!uploadURL) {
        return res.status(400).json({ message: "Upload URL is required" });
      }

      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      let familyId = user.familyId;
      
      // If admin and familyId provided, use that
      if (isAdmin(req.userRole!) && req.body.familyId) {
        familyId = req.body.familyId;
      }

      if (!familyId) {
        return res.status(400).json({ message: "Family ID required" });
      }

      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        uploadURL,
        {
          owner: user.id,
          visibility: "private", // Documents are private to family/admin
          // Add ACL rules for family members and admins
        }
      );

      // Save document record to database
      const document = await storage.createDocument({
        familyId,
        familyTaskId,
        fileName,
        originalFileName,
        fileSize,
        mimeType,
        objectPath,
        uploadedBy: user.id,
      });

      // Send notification for document upload
      try {
        const family = await storage.getFamily(familyId);
        let familyTaskWithTask = null;
        
        // Get family task data if document is linked to a task
        if (familyTaskId) {
          familyTaskWithTask = await storage.getFamilyTaskWithTask(familyTaskId);
        }
        
        if (family) {
          await notificationService.queueDocumentUpload(
            document,
            user,
            family,
            familyTaskWithTask || undefined
          );
        }
      } catch (notificationError) {
        console.error("Error sending document upload notification:", notificationError);
        // Don't fail the request if notification fails
      }

      res.status(201).json(document);
    } catch (error) {
      console.error("Error creating document:", error);
      res.status(500).json({ message: "Failed to create document" });
    }
  });

  // Message endpoints
  app.get('/api/messages', isAuthenticated, loadUserRole, async (req: AuthenticatedRequest, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      let familyId = user.familyId;
      
      // If admin and familyId query param provided, use that
      if (isAdmin(req.userRole!) && req.query.familyId) {
        familyId = req.query.familyId;
      }

      if (!familyId) {
        return res.status(400).json({ message: "Family ID required" });
      }

      const messages = await storage.getFamilyMessages(familyId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post('/api/messages', isAuthenticated, loadUserRole, async (req: AuthenticatedRequest, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // SECURITY: Validate familyId access before allowing message creation
      const requestedFamilyId = req.body.familyId;
      
      // Non-admin users can only create messages for their own family
      if (!isAdmin(req.userRole!)) {
        if (!user.familyId) {
          return res.status(403).json({ message: "Access denied - user not part of any family" });
        }
        if (requestedFamilyId !== user.familyId) {
          return res.status(403).json({ message: "Access denied - cannot create messages for other families" });
        }
      }
      
      // Admin users can create messages for any family, but familyId must be provided
      if (isAdmin(req.userRole!) && !requestedFamilyId) {
        return res.status(400).json({ message: "Family ID required for admin message creation" });
      }

      const messageData = insertMessageSchema.parse({
        ...req.body,
        fromUserId: user.id,
      });

      const message = await storage.createMessage(messageData);
      
      // Send notification for admin messages to family members
      if (isAdmin(req.userRole!)) {
        try {
          const family = await storage.getFamily(messageData.familyId);
          if (family) {
            await notificationService.queueAdminMessage(message, user, family);
          }
        } catch (notificationError) {
          console.error("Error sending admin message notification:", notificationError);
          // Don't fail the request if notification fails
        }
      }
      
      res.status(201).json(message);
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  // Notification preferences endpoints
  app.get('/api/notifications/preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const preferences = await storage.getUserNotificationPreferences(userId);
      
      // Return default preferences if none exist
      if (!preferences) {
        return res.json({
          emailOnTaskStatus: true,
          emailOnDocumentUpload: true,
          emailOnAdminMessage: true,
          emailOnInvitations: true,
        });
      }
      
      res.json(preferences);
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
      res.status(500).json({ message: "Failed to fetch notification preferences" });
    }
  });

  app.put('/api/notifications/preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const preferencesData = insertNotificationPreferencesSchema.parse({
        userId,
        ...req.body,
      });
      
      const preferences = await storage.setUserNotificationPreferences(preferencesData);
      res.json(preferences);
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      res.status(500).json({ message: "Failed to update notification preferences" });
    }
  });

  // Invitation endpoints
  app.post('/api/invitations', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!user.familyId) {
        return res.status(403).json({ message: "You must be part of a family to send invitations" });
      }

      const { inviteeEmail } = req.body;
      
      if (!inviteeEmail) {
        return res.status(400).json({ message: "Invitee email is required" });
      }

      // Check if user is already part of the family
      const existingUser = await db.query.users.findFirst({
        where: and(eq(users.email, inviteeEmail), eq(users.familyId, user.familyId))
      });
      
      if (existingUser) {
        return res.status(400).json({ message: "User is already part of your family" });
      }

      // Check for existing pending invitation
      const existingInvitation = await db.query.invitations.findFirst({
        where: and(
          eq(invitations.familyId, user.familyId),
          eq(invitations.inviteeEmail, inviteeEmail),
          eq(invitations.status, "pending")
        )
      });
      
      if (existingInvitation) {
        return res.status(400).json({ message: "Invitation already sent to this email" });
      }

      // Generate secure invitation code and expiration
      const invitationCode = nanoid(32);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const invitationData = insertInvitationSchema.parse({
        familyId: user.familyId,
        inviterUserId: user.id,
        inviteeEmail,
        invitationCode,
        expiresAt,
      });

      const invitation = await storage.createInvitation(invitationData);
      
      // Send invitation notification
      try {
        const family = await storage.getFamily(user.familyId!);
        if (family) {
          await notificationService.queueInvitation(invitation, user, family);
        }
      } catch (notificationError) {
        console.error("Error sending invitation notification:", notificationError);
        // Don't fail the request if notification fails
      }
      
      // Return complete invitation including the invitationCode (needed for sharing)
      res.status(201).json(invitation);
    } catch (error) {
      console.error("Error creating invitation:", error);
      res.status(500).json({ message: "Failed to create invitation" });
    }
  });

  app.get('/api/invitations', isAuthenticated, loadUserRole, async (req: AuthenticatedRequest, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      let familyId = user.familyId;
      
      // If admin and familyId query param provided, use that
      if (isAdmin(req.userRole!) && req.query.familyId) {
        familyId = req.query.familyId;
      }

      if (!familyId) {
        return res.status(400).json({ message: "Family ID required" });
      }

      // Auto-expire old invitations
      await storage.expireOldInvitations();

      const invitations = await storage.getFamilyInvitations(familyId);
      
      // Remove invitation codes from response for security
      const safeInvitations = invitations.map(({ invitationCode, ...inv }) => inv);
      res.json(safeInvitations);
    } catch (error) {
      console.error("Error fetching invitations:", error);
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  app.get('/api/invitations/received/:email', async (req, res) => {
    try {
      const { email } = req.params;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Auto-expire old invitations
      await storage.expireOldInvitations();

      const invitations = await storage.getInvitationsByEmail(email);
      
      // Remove invitation codes from response for security  
      const safeInvitations = invitations.map(({ invitationCode, ...inv }) => inv);
      res.json(safeInvitations);
    } catch (error) {
      console.error("Error fetching invitations by email:", error);
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  app.get('/api/invitations/code/:code', async (req, res) => {
    try {
      const { code } = req.params;
      
      if (!code) {
        return res.status(400).json({ message: "Invitation code is required" });
      }

      // Auto-expire old invitations
      await storage.expireOldInvitations();

      const invitation = await db.query.invitations.findFirst({
        where: eq(invitations.invitationCode, code),
        with: {
          family: true,
          inviter: true,
        },
      });
      
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      // Remove invitation code from response for security
      const { invitationCode, ...safeInvitation } = invitation;
      res.json(safeInvitation);
    } catch (error) {
      console.error("Error fetching invitation by code:", error);
      res.status(500).json({ message: "Failed to fetch invitation" });
    }
  });

  app.put('/api/invitations/:code/accept', isAuthenticated, async (req: any, res) => {
    try {
      const { code } = req.params;
      const userId = req.user.claims.sub;
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.familyId) {
        return res.status(400).json({ message: "You are already part of a family" });
      }

      // Auto-expire old invitations
      await storage.expireOldInvitations();

      const invitation = await storage.getInvitationByCode(code);
      if (!invitation) {
        return res.status(404).json({ message: "Invalid invitation code" });
      }

      if (invitation.status !== "pending") {
        return res.status(400).json({ message: "Invitation is no longer valid" });
      }

      if (invitation.inviteeEmail !== user.email) {
        return res.status(403).json({ message: "This invitation is not for your email address" });
      }

      // Accept the invitation
      await storage.updateInvitationStatus(invitation.id, "accepted");
      
      // Add user to the family
      await storage.upsertUser({
        ...user,
        familyId: invitation.familyId,
        role: 'family'
      });

      res.json({ message: "Invitation accepted successfully" });
    } catch (error) {
      console.error("Error accepting invitation:", error);
      res.status(500).json({ message: "Failed to accept invitation" });
    }
  });

  app.delete('/api/invitations/:id', isAuthenticated, loadUserRole, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const user = await storage.getUser(req.user.claims.sub);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const invitation = await db.query.invitations.findFirst({
        where: eq(invitations.id, id)
      });
      
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      // Only the inviter or admin can cancel the invitation
      if (!isAdmin(req.userRole!) && invitation.inviterUserId !== user.id) {
        return res.status(403).json({ message: "Access denied - you can only cancel invitations you sent" });
      }

      await storage.deleteInvitation(id);
      res.json({ message: "Invitation cancelled successfully" });
    } catch (error) {
      console.error("Error cancelling invitation:", error);
      res.status(500).json({ message: "Failed to cancel invitation" });
    }
  });

  // Statistics endpoints
  app.get('/api/stats/family/:familyId', isAuthenticated, loadUserRole, async (req: AuthenticatedRequest, res) => {
    try {
      const { familyId } = req.params;
      const user = await storage.getUser(req.user.claims.sub);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check access - user must be family member or admin
      if (user.familyId !== familyId && !isAdmin(req.userRole!)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const stats = await storage.getFamilyStats(familyId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching family stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get('/api/stats/admin', isAuthenticated, loadUserRole, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {

      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch admin stats" });
    }
  });

  // ==================== US CODE INDEXING API ====================
  
  // Middleware to authenticate Parlant service requests
  const authenticateParlantService = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    const expectedSecret = process.env.PARLANT_SHARED_SECRET || "family-portal-ai-secret-2024";
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: "Missing or invalid authorization header" });
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    if (token !== expectedSecret) {
      return res.status(401).json({ success: false, message: "Invalid authentication token" });
    }
    
    next();
  };
  
  // US Code Search endpoint - accessible to Parlant service and authenticated users
  app.get('/api/uscode/search', (req: any, res: any, next: any) => {
    // Try Parlant service auth first, then fall back to user auth
    const authHeader = req.headers.authorization;
    const expectedSecret = process.env.PARLANT_SHARED_SECRET || "family-portal-ai-secret-2024";
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (token === expectedSecret) {
        // Parlant service authentication successful
        return next();
      }
    }
    
    // Fall back to user authentication
    isAuthenticated(req, res, (err: any) => {
      if (err) return next(err);
      loadUserRole(req, res, next);
    });
  }, async (req: AuthenticatedRequest | any, res) => {
    try {
      const { q: query, title, limit, offset, type } = req.query;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ 
          message: "Search query 'q' parameter is required" 
        });
      }

      const searchOptions = {
        titleNumber: title ? parseInt(title as string) : undefined,
        limit: limit ? parseInt(limit as string) : 20,
        offset: offset ? parseInt(offset as string) : 0,
        searchType: (type as 'fulltext' | 'citation' | 'keyword') || 'fulltext',
        includeHeadings: true,
      };

      const results = await storage.searchUsCodeSections(query, searchOptions);
      
      res.json({
        success: true,
        data: results,
        pagination: {
          limit: searchOptions.limit,
          offset: searchOptions.offset,
          totalCount: results.totalCount,
          hasMore: results.totalCount > (searchOptions.offset + searchOptions.limit),
        }
      });
    } catch (error) {
      console.error("Error searching US Code:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to search US Code" 
      });
    }
  });

  // US Code Titles listing - accessible to all authenticated users
  app.get('/api/uscode/titles', isAuthenticated, loadUserRole, async (req: AuthenticatedRequest, res) => {
    try {
      const titles = await storage.getAllUsCodeTitles();
      
      res.json({
        success: true,
        data: titles,
        count: titles.length
      });
    } catch (error) {
      console.error("Error fetching US Code titles:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to fetch US Code titles" 
      });
    }
  });

  // Get specific US Code title by number
  app.get('/api/uscode/titles/:number', isAuthenticated, loadUserRole, async (req: AuthenticatedRequest, res) => {
    try {
      const titleNumber = parseInt(req.params.number);
      
      if (isNaN(titleNumber)) {
        return res.status(400).json({ 
          success: false,
          message: "Invalid title number" 
        });
      }

      const title = await storage.getUsCodeTitleByNumber(titleNumber);
      if (!title) {
        return res.status(404).json({ 
          success: false,
          message: "US Code title not found" 
        });
      }

      // Get chapters for this title
      const chapters = await storage.getChaptersByTitle(title.id);
      
      res.json({
        success: true,
        data: {
          ...title,
          chapters
        }
      });
    } catch (error) {
      console.error("Error fetching US Code title:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to fetch US Code title" 
      });
    }
  });

  // Get sections by title
  app.get('/api/uscode/titles/:number/sections', isAuthenticated, loadUserRole, async (req: AuthenticatedRequest, res) => {
    try {
      const titleNumber = parseInt(req.params.number);
      const { limit, offset } = req.query;
      
      if (isNaN(titleNumber)) {
        return res.status(400).json({ 
          success: false,
          message: "Invalid title number" 
        });
      }

      const title = await storage.getUsCodeTitleByNumber(titleNumber);
      if (!title) {
        return res.status(404).json({ 
          success: false,
          message: "US Code title not found" 
        });
      }

      const sections = await storage.getSectionsByTitle(title.id);
      
      // Apply pagination if specified
      const limitNum = limit ? parseInt(limit as string) : sections.length;
      const offsetNum = offset ? parseInt(offset as string) : 0;
      const paginatedSections = sections.slice(offsetNum, offsetNum + limitNum);
      
      res.json({
        success: true,
        data: paginatedSections,
        pagination: {
          limit: limitNum,
          offset: offsetNum,
          totalCount: sections.length,
          hasMore: sections.length > (offsetNum + limitNum),
        }
      });
    } catch (error) {
      console.error("Error fetching title sections:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to fetch title sections" 
      });
    }
  });

  // Get specific section by citation
  app.get('/api/uscode/sections/:citation', isAuthenticated, loadUserRole, async (req: AuthenticatedRequest, res) => {
    try {
      const { citation } = req.params;
      
      if (!citation) {
        return res.status(400).json({ 
          success: false,
          message: "Citation parameter is required" 
        });
      }

      const section = await storage.getUsCodeSectionByCitation(citation);
      if (!section) {
        return res.status(404).json({ 
          success: false,
          message: "US Code section not found" 
        });
      }

      // Get related data
      const [title, crossReferences] = await Promise.all([
        storage.getUsCodeTitle(section.titleId),
        storage.getCrossReferencesForSection(section.id)
      ]);

      res.json({
        success: true,
        data: {
          ...section,
          title,
          crossReferences
        }
      });
    } catch (error) {
      console.error("Error fetching US Code section:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to fetch US Code section" 
      });
    }
  });

  // US Code Statistics (Admin only)
  app.get('/api/uscode/stats', isAuthenticated, loadUserRole, requirePermission(Permission.VIEW_ADMIN_DASHBOARD), async (req: AuthenticatedRequest, res) => {
    try {
      const stats = await storage.getUsCodeStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error("Error fetching US Code statistics:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to fetch US Code statistics" 
      });
    }
  });

  // US Code Indexing Jobs Management (Admin only)
  app.get('/api/uscode/index/jobs', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_SYSTEM_SETTINGS), async (req: AuthenticatedRequest, res) => {
    try {
      const { limit } = req.query;
      const limitNum = limit ? parseInt(limit as string) : 50;
      
      const jobs = await storage.getIndexingJobHistory(limitNum);
      
      res.json({
        success: true,
        data: jobs
      });
    } catch (error) {
      console.error("Error fetching indexing jobs:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to fetch indexing jobs" 
      });
    }
  });

  // Start new indexing job (Admin only)
  app.post('/api/uscode/index/jobs', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_SYSTEM_SETTINGS), async (req: AuthenticatedRequest, res) => {
    try {
      const { titleNumber, jobType = 'full_index' } = req.body;
      const userId = req.user.claims.sub;
      
      // Check for existing running jobs
      const activeJobs = await storage.getActiveIndexingJobs();
      if (activeJobs.length > 0) {
        return res.status(409).json({ 
          success: false,
          message: "Another indexing job is already running",
          activeJobs: activeJobs.map(job => ({ id: job.id, status: job.status, titleNumber: job.titleNumber }))
        });
      }

      // Create new indexing job
      const jobData = {
        titleNumber: titleNumber || null,
        status: 'pending',
        startedBy: userId,
        jobType,
        progress: { stage: 'initializing', percentage: 0 },
        stats: { processed: 0, errors: 0 },
      };

      const newJob = await storage.createIndexingJob(jobData);
      
      res.status(201).json({
        success: true,
        data: newJob,
        message: "Indexing job created successfully"
      });
    } catch (error) {
      console.error("Error creating indexing job:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to create indexing job" 
      });
    }
  });

  // Get specific indexing job status
  app.get('/api/uscode/index/jobs/:jobId', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_SYSTEM_SETTINGS), async (req: AuthenticatedRequest, res) => {
    try {
      const { jobId } = req.params;
      
      const job = await storage.getIndexingJob(jobId);
      if (!job) {
        return res.status(404).json({ 
          success: false,
          message: "Indexing job not found" 
        });
      }

      res.json({
        success: true,
        data: job
      });
    } catch (error) {
      console.error("Error fetching indexing job:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to fetch indexing job" 
      });
    }
  });

  // US Code Maintenance Operations (Admin only)
  app.post('/api/uscode/maintenance/optimize', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_SYSTEM_SETTINGS), async (req: AuthenticatedRequest, res) => {
    try {
      const results = await storage.optimizeSearchIndexes();
      
      res.json({
        success: true,
        data: results,
        message: "Search index optimization completed"
      });
    } catch (error) {
      console.error("Error optimizing search indexes:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to optimize search indexes" 
      });
    }
  });

  app.get('/api/uscode/maintenance/validate', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_SYSTEM_SETTINGS), async (req: AuthenticatedRequest, res) => {
    try {
      const validation = await storage.validateCrossReferences();
      
      res.json({
        success: true,
        data: validation,
        message: "Cross-reference validation completed"
      });
    } catch (error) {
      console.error("Error validating cross references:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to validate cross references" 
      });
    }
  });

  // Rebuild search indexes (Admin only)
  app.post('/api/uscode/index/rebuild', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_SYSTEM_SETTINGS), async (req: AuthenticatedRequest, res) => {
    try {
      const { titleNumber } = req.body;
      
      const results = await storage.rebuildSearchIndexes(titleNumber);
      
      res.json({
        success: true,
        data: results,
        message: "Search index rebuild completed"
      });
    } catch (error) {
      console.error("Error rebuilding search indexes:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to rebuild search indexes" 
      });
    }
  });

  // ==================== US CODE SCHEDULER ADMIN ENDPOINTS ====================
  
  // Get scheduler health and status
  app.get('/api/admin/uscode/scheduler/status', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_SYSTEM_SETTINGS), async (req: AuthenticatedRequest, res) => {
    try {
      const { getSchedulerHealth } = await import('./scheduling/USCodeScheduler');
      const health = getSchedulerHealth();
      
      res.json({
        success: true,
        data: health
      });
    } catch (error) {
      console.error('Error getting scheduler status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get scheduler status'
      });
    }
  });

  // Update scheduler configuration
  app.put('/api/admin/uscode/scheduler/config', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_SYSTEM_SETTINGS), async (req: AuthenticatedRequest, res) => {
    try {
      const { updateSchedulerConfiguration } = await import('./scheduling/USCodeScheduler');
      const config = req.body;
      
      // Validate configuration
      if (config.schedule && !require('node-cron').validate(config.schedule)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid cron schedule format'
        });
      }
      
      await updateSchedulerConfiguration(config);
      
      res.json({
        success: true,
        message: 'Scheduler configuration updated successfully'
      });
    } catch (error) {
      console.error('Error updating scheduler configuration:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update scheduler configuration'
      });
    }
  });

  // Get scheduler configuration
  app.get('/api/admin/uscode/scheduler/config', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_SYSTEM_SETTINGS), async (req: AuthenticatedRequest, res) => {
    try {
      const { usCodeScheduler } = await import('./scheduling/USCodeScheduler');
      const config = usCodeScheduler.getConfiguration();
      
      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      console.error('Error getting scheduler configuration:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get scheduler configuration'
      });
    }
  });

  // Manually trigger full re-indexing
  app.post('/api/admin/uscode/reindex', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_SYSTEM_SETTINGS), async (req: AuthenticatedRequest, res) => {
    try {
      const { triggerManualIndexing } = await import('./scheduling/USCodeScheduler');
      const userId = req.user.claims.sub;
      
      const jobId = await triggerManualIndexing('full', userId);
      
      res.status(202).json({
        success: true,
        data: { jobId },
        message: 'Full re-indexing job started successfully'
      });
    } catch (error) {
      console.error('Error triggering manual full indexing:', error);
      
      if (error instanceof Error && error.message.includes('already running')) {
        return res.status(409).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to start re-indexing job'
      });
    }
  });

  // Manually trigger incremental indexing
  app.post('/api/admin/uscode/reindex/incremental', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_SYSTEM_SETTINGS), async (req: AuthenticatedRequest, res) => {
    try {
      const { triggerManualIndexing } = await import('./scheduling/USCodeScheduler');
      const userId = req.user.claims.sub;
      
      const jobId = await triggerManualIndexing('incremental', userId);
      
      res.status(202).json({
        success: true,
        data: { jobId },
        message: 'Incremental indexing job started successfully'
      });
    } catch (error) {
      console.error('Error triggering manual incremental indexing:', error);
      
      if (error instanceof Error && error.message.includes('already running')) {
        return res.status(409).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to start incremental indexing job'
      });
    }
  });

  // Get current indexing job status
  app.get('/api/admin/uscode/indexing-status', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_SYSTEM_SETTINGS), async (req: AuthenticatedRequest, res) => {
    try {
      const activeJobs = await storage.getActiveIndexingJobs();
      const recentJobs = await storage.getIndexingJobHistory(10);
      const { getSchedulerHealth } = await import('./scheduling/USCodeScheduler');
      const schedulerHealth = getSchedulerHealth();
      
      res.json({
        success: true,
        data: {
          activeJobs,
          recentJobs,
          schedulerHealth,
          hasActiveJobs: activeJobs.length > 0
        }
      });
    } catch (error) {
      console.error('Error getting indexing status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get indexing status'
      });
    }
  });

  // Stop/cancel running indexing job
  app.post('/api/admin/uscode/indexing/:jobId/cancel', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_SYSTEM_SETTINGS), async (req: AuthenticatedRequest, res) => {
    try {
      const { jobId } = req.params;
      
      // Update job status to cancelled
      const job = await storage.updateIndexingJobStatus(jobId, 'cancelled');
      
      res.json({
        success: true,
        data: job,
        message: 'Indexing job cancelled successfully'
      });
    } catch (error) {
      console.error('Error cancelling indexing job:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cancel indexing job'
      });
    }
  });

  // Enhanced health check with scheduler information
  app.get('/api/admin/uscode/health', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_SYSTEM_SETTINGS), async (req: AuthenticatedRequest, res) => {
    try {
      // Get US Code statistics
      const usCodeStats = await storage.getUsCodeStats();
      
      // Get scheduler health
      const { getSchedulerHealth } = await import('./scheduling/USCodeScheduler');
      const schedulerHealth = getSchedulerHealth();
      
      // Get recent job history for analysis
      const recentJobs = await storage.getIndexingJobHistory(20);
      const completedJobs = recentJobs.filter(job => job.status === 'completed');
      const failedJobs = recentJobs.filter(job => job.status === 'failed');
      
      // Calculate success rate
      const totalRecentJobs = completedJobs.length + failedJobs.length;
      const successRate = totalRecentJobs > 0 ? (completedJobs.length / totalRecentJobs) * 100 : 0;
      
      // Determine overall health status
      let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (schedulerHealth.status === 'unhealthy' || successRate < 50) {
        overallStatus = 'unhealthy';
      } else if (schedulerHealth.status === 'degraded' || successRate < 80) {
        overallStatus = 'degraded';
      }
      
      res.json({
        success: true,
        data: {
          overall: {
            status: overallStatus,
            timestamp: new Date(),
          },
          usCode: usCodeStats,
          scheduler: schedulerHealth,
          recentPerformance: {
            totalJobs: totalRecentJobs,
            successRate,
            completedJobs: completedJobs.length,
            failedJobs: failedJobs.length,
          }
        }
      });
    } catch (error) {
      console.error('Error getting system health:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get system health'
      });
    }
  });

  // ==================== UCC (UNIFORM COMMERCIAL CODE) API ====================
  
  // UCC Article Management
  app.get('/api/ucc/articles', isAuthenticated, loadUserRole, requirePermission(Permission.VIEW_ADMIN_DASHBOARD), async (req: AuthenticatedRequest, res) => {
    try {
      const articles = await storage.getAllUccArticles();
      
      res.json({
        success: true,
        data: articles
      });
    } catch (error) {
      console.error("Error fetching UCC articles:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to fetch UCC articles" 
      });
    }
  });

  app.post('/api/ucc/articles', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_SYSTEM_SETTINGS), async (req: AuthenticatedRequest, res) => {
    try {
      const articleData = insertUccArticleSchema.parse(req.body);
      const article = await storage.createUccArticle(articleData);
      
      res.status(201).json({
        success: true,
        data: article,
        message: "UCC article created successfully"
      });
    } catch (error) {
      console.error("Error creating UCC article:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to create UCC article" 
      });
    }
  });

  app.get('/api/ucc/articles/:articleNumber', isAuthenticated, loadUserRole, requirePermission(Permission.VIEW_ADMIN_DASHBOARD), async (req: AuthenticatedRequest, res) => {
    try {
      const { articleNumber } = req.params;
      const article = await storage.getUccArticleByNumber(articleNumber);
      
      if (!article) {
        return res.status(404).json({ 
          success: false,
          message: "UCC article not found" 
        });
      }

      res.json({
        success: true,
        data: article
      });
    } catch (error) {
      console.error("Error fetching UCC article:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to fetch UCC article" 
      });
    }
  });

  // UCC Parts Management
  app.post('/api/ucc/parts', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_SYSTEM_SETTINGS), async (req: AuthenticatedRequest, res) => {
    try {
      const partData = insertUccPartSchema.parse(req.body);
      const part = await storage.createUccPart(partData);
      
      res.status(201).json({
        success: true,
        data: part,
        message: "UCC part created successfully"
      });
    } catch (error) {
      console.error("Error creating UCC part:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to create UCC part" 
      });
    }
  });

  app.get('/api/ucc/articles/:articleId/parts', isAuthenticated, loadUserRole, requirePermission(Permission.VIEW_ADMIN_DASHBOARD), async (req: AuthenticatedRequest, res) => {
    try {
      const { articleId } = req.params;
      const parts = await storage.getPartsByArticle(articleId);
      
      res.json({
        success: true,
        data: parts
      });
    } catch (error) {
      console.error("Error fetching UCC parts:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to fetch UCC parts" 
      });
    }
  });

  // UCC Sections Management
  app.post('/api/ucc/sections', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_SYSTEM_SETTINGS), async (req: AuthenticatedRequest, res) => {
    try {
      const sectionData = insertUccSectionSchema.parse(req.body);
      const section = await storage.createUccSection(sectionData);
      
      res.status(201).json({
        success: true,
        data: section,
        message: "UCC section created successfully"
      });
    } catch (error) {
      console.error("Error creating UCC section:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to create UCC section" 
      });
    }
  });

  app.get('/api/ucc/sections/by-citation/:citation', isAuthenticated, loadUserRole, requirePermission(Permission.VIEW_ADMIN_DASHBOARD), async (req: AuthenticatedRequest, res) => {
    try {
      const { citation } = req.params;
      const section = await storage.getUccSectionByCitation(citation);
      
      if (!section) {
        return res.status(404).json({ 
          success: false,
          message: "UCC section not found" 
        });
      }

      res.json({
        success: true,
        data: section
      });
    } catch (error) {
      console.error("Error fetching UCC section:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to fetch UCC section" 
      });
    }
  });

  app.get('/api/ucc/articles/:articleId/sections', isAuthenticated, loadUserRole, requirePermission(Permission.VIEW_ADMIN_DASHBOARD), async (req: AuthenticatedRequest, res) => {
    try {
      const { articleId } = req.params;
      const sections = await storage.getSectionsByArticle(articleId);
      
      res.json({
        success: true,
        data: sections
      });
    } catch (error) {
      console.error("Error fetching UCC sections:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to fetch UCC sections" 
      });
    }
  });

  // UCC Subsections Management
  app.post('/api/ucc/subsections', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_SYSTEM_SETTINGS), async (req: AuthenticatedRequest, res) => {
    try {
      const subsectionData = insertUccSubsectionSchema.parse(req.body);
      const subsection = await storage.createUccSubsection(subsectionData);
      
      res.status(201).json({
        success: true,
        data: subsection,
        message: "UCC subsection created successfully"
      });
    } catch (error) {
      console.error("Error creating UCC subsection:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to create UCC subsection" 
      });
    }
  });

  // UCC Definitions Management
  app.post('/api/ucc/definitions', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_SYSTEM_SETTINGS), async (req: AuthenticatedRequest, res) => {
    try {
      const definitionData = insertUccDefinitionSchema.parse(req.body);
      const definition = await storage.createUccDefinition(definitionData);
      
      res.status(201).json({
        success: true,
        data: definition,
        message: "UCC definition created successfully"
      });
    } catch (error) {
      console.error("Error creating UCC definition:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to create UCC definition" 
      });
    }
  });

  app.get('/api/ucc/definitions/search', isAuthenticated, loadUserRole, requirePermission(Permission.VIEW_ADMIN_DASHBOARD), async (req: AuthenticatedRequest, res) => {
    try {
      const { q } = req.query;
      
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ 
          success: false,
          message: "Search query is required" 
        });
      }

      const definitions = await storage.searchUccDefinitions(q);
      
      res.json({
        success: true,
        data: definitions
      });
    } catch (error) {
      console.error("Error searching UCC definitions:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to search UCC definitions" 
      });
    }
  });

  // UCC Cross References Management
  app.post('/api/ucc/cross-references', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_SYSTEM_SETTINGS), async (req: AuthenticatedRequest, res) => {
    try {
      const crossRefData = insertUccCrossReferenceSchema.parse(req.body);
      const crossRef = await storage.createUccCrossReference(crossRefData);
      
      res.status(201).json({
        success: true,
        data: crossRef,
        message: "UCC cross-reference created successfully"
      });
    } catch (error) {
      console.error("Error creating UCC cross-reference:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to create UCC cross-reference" 
      });
    }
  });

  // UCC Search Index Management
  app.post('/api/ucc/search-index', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_SYSTEM_SETTINGS), async (req: AuthenticatedRequest, res) => {
    try {
      const searchIndexData = insertUccSearchIndexSchema.parse(req.body);
      const searchIndex = await storage.createUccSearchIndex(searchIndexData);
      
      res.status(201).json({
        success: true,
        data: searchIndex,
        message: "UCC search index created successfully"
      });
    } catch (error) {
      console.error("Error creating UCC search index:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to create UCC search index" 
      });
    }
  });

  app.post('/api/ucc/search-index/optimize', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_SYSTEM_SETTINGS), async (req: AuthenticatedRequest, res) => {
    try {
      // TODO: Implement UCC search index optimization
      const results = { optimized: 0, errors: [] };
      
      res.json({
        success: true,
        data: results,
        message: "UCC search index optimization completed"
      });
    } catch (error) {
      console.error("Error optimizing UCC search indexes:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to optimize UCC search indexes" 
      });
    }
  });

  // UCC Search Operations
  app.get('/api/ucc/search', isAuthenticated, loadUserRole, async (req: AuthenticatedRequest, res) => {
    try {
      const { q, article, limit = 20, offset = 0 } = req.query;
      
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ 
          success: false,
          message: "Search query is required" 
        });
      }

      const options = {
        articleNumber: article as string,
        limit: parseInt(limit as string) || 20,
        offset: parseInt(offset as string) || 0
      };

      const searchResults = await storage.searchUccSections(q, options);
      
      res.json({
        success: true,
        data: searchResults
      });
    } catch (error) {
      console.error("Error searching UCC sections:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to search UCC sections" 
      });
    }
  });

  // UCC Statistics
  app.get('/api/ucc/stats', isAuthenticated, loadUserRole, requirePermission(Permission.VIEW_ADMIN_DASHBOARD), async (req: AuthenticatedRequest, res) => {
    try {
      const stats = await storage.getUccStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error("Error fetching UCC statistics:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to fetch UCC statistics" 
      });
    }
  });

  app.post('/api/ucc/stats/update', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_SYSTEM_SETTINGS), async (req: AuthenticatedRequest, res) => {
    try {
      // TODO: Update UCC statistics cache
      res.json({
        success: true,
        message: "UCC statistics updated successfully"
      });
    } catch (error) {
      console.error("Error updating UCC statistics:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to update UCC statistics" 
      });
    }
  });

  // ==================== UCC INDEXING JOB MANAGEMENT ====================
  
  // Get UCC indexing job history
  app.get('/api/ucc/index/jobs', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_SYSTEM_SETTINGS), async (req: AuthenticatedRequest, res) => {
    try {
      const { limit } = req.query;
      const limitNum = limit ? parseInt(limit as string) : 50;
      
      const jobs = await storage.getUccIndexingJobHistory(limitNum);
      
      res.json({
        success: true,
        data: jobs
      });
    } catch (error) {
      console.error("Error fetching UCC indexing jobs:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to fetch UCC indexing jobs" 
      });
    }
  });

  // Start new UCC indexing job
  app.post('/api/ucc/index/jobs', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_SYSTEM_SETTINGS), async (req: AuthenticatedRequest, res) => {
    try {
      const { articleNumber, jobType = 'full_index' } = req.body;
      const userId = req.user.claims.sub;
      
      // Check for existing running UCC jobs
      const activeJobs = await storage.getActiveUccIndexingJobs();
      if (activeJobs.length > 0) {
        return res.status(409).json({ 
          success: false,
          message: "Another UCC indexing job is already running",
          activeJobs: activeJobs.map(job => ({ id: job.id, status: job.status, articleNumber: job.articleNumber }))
        });
      }

      // Create new UCC indexing job
      const jobData = {
        articleNumber: articleNumber || null,
        status: 'pending',
        jobType,
        progress: { stage: 'initializing', percentage: 0 },
        stats: { processed: 0, errors: 0 },
      };

      const newJob = await storage.createUccIndexingJob(jobData);
      
      // Start the Python indexing process
      try {
        const pythonArgs = ['ucc_indexer.py', '--full-index'];
        if (articleNumber) {
          pythonArgs.push('--article', articleNumber);
        }
        
        const indexingProcess = spawn('python3', pythonArgs, {
          cwd: process.cwd(),
          stdio: 'pipe',
          env: {
            ...process.env,
            UCC_JOB_ID: newJob.id,
            BACKEND_URL: `${req.protocol}://${req.get('host')}`
          }
        });

        indexingProcess.stdout?.on('data', (data) => {
          console.log(`UCC Indexer stdout: ${data}`);
        });

        indexingProcess.stderr?.on('data', (data) => {
          console.error(`UCC Indexer stderr: ${data}`);
        });

        indexingProcess.on('close', (code) => {
          console.log(`UCC Indexer process exited with code ${code}`);
        });
        
      } catch (pythonError) {
        console.error("Failed to start UCC Python indexing process:", pythonError);
        await storage.updateUccIndexingJobError(newJob.id, `Failed to start indexing process: ${pythonError}`);
      }
      
      res.status(201).json({
        success: true,
        data: newJob,
        message: "UCC indexing job created successfully"
      });
    } catch (error) {
      console.error("Error creating UCC indexing job:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to create UCC indexing job" 
      });
    }
  });

  // Get specific UCC indexing job status
  app.get('/api/ucc/index/jobs/:jobId', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_SYSTEM_SETTINGS), async (req: AuthenticatedRequest, res) => {
    try {
      const { jobId } = req.params;
      
      const job = await storage.getUccIndexingJob(jobId);
      if (!job) {
        return res.status(404).json({ 
          success: false,
          message: "UCC indexing job not found" 
        });
      }

      res.json({
        success: true,
        data: job
      });
    } catch (error) {
      console.error("Error fetching UCC indexing job:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to fetch UCC indexing job" 
      });
    }
  });

  // Update UCC indexing job status (for Python indexer)
  app.put('/api/ucc/index/jobs/:jobId', async (req, res) => {
    try {
      const { jobId } = req.params;
      const { status, progress, stats, errorMessage } = req.body;
      
      // Verify the request comes from the indexing process
      const authHeader = req.headers.authorization;
      const expectedToken = `Bearer ${process.env.PARLANT_SHARED_SECRET || 'family-portal-ai-secret-2024'}`;
      
      if (!authHeader || authHeader !== expectedToken) {
        return res.status(401).json({ 
          success: false,
          message: "Unauthorized" 
        });
      }

      let updatedJob;
      
      if (errorMessage) {
        updatedJob = await storage.updateUccIndexingJobError(jobId, errorMessage);
      } else {
        updatedJob = await storage.updateUccIndexingJobStatus(jobId, status, progress, stats);
      }
      
      res.json({
        success: true,
        data: updatedJob,
        message: "UCC indexing job updated successfully"
      });
    } catch (error) {
      console.error("Error updating UCC indexing job:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to update UCC indexing job" 
      });
    }
  });

  // Cancel UCC indexing job
  app.post('/api/ucc/index/jobs/:jobId/cancel', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_SYSTEM_SETTINGS), async (req: AuthenticatedRequest, res) => {
    try {
      const { jobId } = req.params;
      
      // Update job status to cancelled
      const job = await storage.updateUccIndexingJobStatus(jobId, 'cancelled');
      
      res.json({
        success: true,
        data: job,
        message: 'UCC indexing job cancelled successfully'
      });
    } catch (error) {
      console.error('Error cancelling UCC indexing job:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cancel UCC indexing job'
      });
    }
  });

  // ==================== UCC ADMIN ENDPOINTS ====================
  
  // Manual UCC full re-indexing
  app.post('/api/admin/ucc/reindex', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_SYSTEM_SETTINGS), async (req: AuthenticatedRequest, res) => {
    try {
      const { articleNumber } = req.body;
      const userId = req.user.claims.sub;
      
      // Check for existing running jobs
      const activeJobs = await storage.getActiveUccIndexingJobs();
      if (activeJobs.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Another UCC indexing job is already running'
        });
      }
      
      // Create new indexing job
      const jobData = {
        articleNumber: articleNumber || null,
        status: 'pending',
        jobType: 'manual_full',
        progress: { stage: 'initializing', percentage: 0 },
        stats: { processed: 0, errors: 0 },
      };

      const newJob = await storage.createUccIndexingJob(jobData);
      
      res.status(202).json({
        success: true,
        data: { jobId: newJob.id },
        message: 'UCC full re-indexing job started successfully'
      });
    } catch (error) {
      console.error('Error triggering UCC manual full indexing:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to start UCC re-indexing job'
      });
    }
  });

  // UCC incremental indexing
  app.post('/api/admin/ucc/reindex/incremental', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_SYSTEM_SETTINGS), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Check for existing running jobs
      const activeJobs = await storage.getActiveUccIndexingJobs();
      if (activeJobs.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Another UCC indexing job is already running'
        });
      }
      
      // Create new incremental indexing job
      const jobData = {
        status: 'pending',
        jobType: 'incremental',
        progress: { stage: 'initializing', percentage: 0 },
        stats: { processed: 0, errors: 0 },
      };

      const newJob = await storage.createUccIndexingJob(jobData);
      
      res.status(202).json({
        success: true,
        data: { jobId: newJob.id },
        message: 'UCC incremental indexing job started successfully'
      });
    } catch (error) {
      console.error('Error triggering UCC incremental indexing:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to start UCC incremental indexing job'
      });
    }
  });

  // Get UCC indexing status
  app.get('/api/admin/ucc/indexing-status', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_SYSTEM_SETTINGS), async (req: AuthenticatedRequest, res) => {
    try {
      const activeJobs = await storage.getActiveUccIndexingJobs();
      const recentJobs = await storage.getUccIndexingJobHistory(10);
      
      res.json({
        success: true,
        data: {
          activeJobs,
          recentJobs,
          hasActiveJobs: activeJobs.length > 0
        }
      });
    } catch (error) {
      console.error('Error getting UCC indexing status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get UCC indexing status'
      });
    }
  });

  // UCC system health check
  app.get('/api/admin/ucc/health', isAuthenticated, loadUserRole, requirePermission(Permission.MANAGE_SYSTEM_SETTINGS), async (req: AuthenticatedRequest, res) => {
    try {
      // Get UCC statistics
      const uccStats = await storage.getUccStats();
      
      // Get recent job history for analysis
      const recentJobs = await storage.getUccIndexingJobHistory(20);
      const completedJobs = recentJobs.filter(job => job.status === 'completed');
      const failedJobs = recentJobs.filter(job => job.status === 'failed');
      
      // Calculate success rate
      const totalRecentJobs = completedJobs.length + failedJobs.length;
      const successRate = totalRecentJobs > 0 ? (completedJobs.length / totalRecentJobs) * 100 : 0;
      
      // Determine overall health status
      let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (successRate < 50) {
        overallStatus = 'unhealthy';
      } else if (successRate < 80) {
        overallStatus = 'degraded';
      }
      
      res.json({
        success: true,
        data: {
          overall: {
            status: overallStatus,
            timestamp: new Date(),
          },
          ucc: uccStats,
          recentPerformance: {
            totalJobs: totalRecentJobs,
            successRate,
            completedJobs: completedJobs.length,
            failedJobs: failedJobs.length,
          }
        }
      });
    } catch (error) {
      console.error('Error getting UCC system health:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get UCC system health'
      });
    }
  });

  const httpServer = createServer(app);
  
  // Initialize sample data and default tasks
  await initializeSampleData();
  await initializeDefaultTasks();
  
  // Run RBAC migration for legacy admin users
  await runRbacMigration();
  
  return httpServer;
}

// Run RBAC migration for legacy admin users
async function runRbacMigration(): Promise<void> {
  try {
    console.log("🚀 Starting RBAC data migration...");
    await migrateAdminUsers();
    const isSuccess = await verifyMigration();
    
    if (isSuccess) {
      console.log("✅ RBAC migration completed successfully!");
    } else {
      console.log("⚠️ RBAC migration verification failed - please check logs");
    }
  } catch (error) {
    console.error("❌ RBAC migration failed:", error);
    // Don't crash the application, just log the error
  }
}

// Initialize Parlant service integration
async function initializeParlantService(): Promise<void> {
  try {
    console.log("Initializing Parlant service integration...");
    
    // Set default environment variables if not already set
    if (!process.env.PARLANT_PORT) {
      process.env.PARLANT_PORT = "8800";
    }
    
    if (!process.env.PARLANT_SHARED_SECRET) {
      process.env.PARLANT_SHARED_SECRET = "family-portal-ai-secret-2024";
      console.log("⚠️  Using default Parlant shared secret. Set PARLANT_SHARED_SECRET environment variable in production.");
    }
    
    if (!process.env.PARLANT_BASE_URL) {
      process.env.PARLANT_BASE_URL = "https://api.parlant.ai";
    }
    
    console.log("Parlant service configuration:");
    console.log(`- Port: ${process.env.PARLANT_PORT}`);
    console.log(`- Host: 127.0.0.1 (localhost only for security)`);
    console.log(`- Base URL: ${process.env.PARLANT_BASE_URL}`);
    console.log(`- Shared secret: ${process.env.PARLANT_SHARED_SECRET ? '[SET]' : '[NOT SET]'}`);
    
    // Start the Parlant service as a background process
    await startParlantService();
    
    console.log("Parlant service integration initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Parlant service:", error);
    console.log("Application will continue without AI chat functionality");
  }
}

// Initialize default scheduler settings
async function initializeSchedulerSettings(): Promise<void> {
  try {
    console.log("Initializing US Code scheduler settings...");
    
    // Define default scheduler settings
    const defaultSettings = [
      {
        key: 'uscode_scheduler_enabled',
        value: true, // Default enabled for production use
        category: 'scheduler',
        description: 'Enable/disable automatic daily US Code re-indexing',
        isReadOnly: false,
      },
      {
        key: 'uscode_scheduler_schedule',
        value: '0 2 * * *', // 2 AM daily
        category: 'scheduler',
        description: 'Cron schedule for automatic US Code re-indexing (2 AM daily)',
        isReadOnly: false,
      },
      {
        key: 'uscode_scheduler_incremental_enabled',
        value: true,
        category: 'scheduler',
        description: 'Enable incremental updates (vs full re-indexing every time)',
        isReadOnly: false,
      },
      {
        key: 'uscode_scheduler_priority_titles',
        value: [15, 18, 26], // Commerce, Employment, Internal Revenue Code
        category: 'scheduler',
        description: 'US Code title numbers to prioritize during indexing',
        isReadOnly: false,
      },
      {
        key: 'uscode_scheduler_max_retries',
        value: 3,
        category: 'scheduler',
        description: 'Maximum number of retries for failed indexing operations',
        isReadOnly: false,
      },
      {
        key: 'uscode_scheduler_timeout_minutes',
        value: 180, // 3 hours
        category: 'scheduler',
        description: 'Timeout for indexing jobs in minutes',
        isReadOnly: false,
      },
      {
        key: 'uscode_scheduler_notify_on_failure',
        value: true,
        category: 'scheduler',
        description: 'Send notifications to admins when indexing jobs fail',
        isReadOnly: false,
      },
    ];
    
    // Create settings if they don't exist
    for (const setting of defaultSettings) {
      const existing = await storage.getSystemSettingByKey(setting.key);
      if (!existing) {
        await storage.upsertSystemSetting(setting);
        console.log(`Created default scheduler setting: ${setting.key}`);
      }
    }
    
    console.log("US Code scheduler settings initialized successfully");
  } catch (error) {
    console.error("Failed to initialize scheduler settings:", error);
  }
}

// Start the Parlant service as a background process
async function startParlantService(): Promise<void> {
  try {
    const { spawn } = await import('child_process');
    
    console.log("Starting Parlant service...");
    
    // Set environment variables for the Python service
    const env = {
      ...process.env,
      PARLANT_PORT: process.env.PARLANT_PORT || "8800",
      PARLANT_SHARED_SECRET: process.env.PARLANT_SHARED_SECRET || "family-portal-ai-secret-2024",
      PARLANT_BASE_URL: process.env.PARLANT_BASE_URL || "https://api.parlant.ai"
    };
    
    // Start the Python service
    const parlantProcess = spawn('python3', ['parlant_service.py'], {
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    // Handle stdout
    parlantProcess.stdout?.on('data', (data) => {
      console.log(`[Parlant] ${data.toString().trim()}`);
    });
    
    // Handle stderr
    parlantProcess.stderr?.on('data', (data) => {
      console.error(`[Parlant Error] ${data.toString().trim()}`);
    });
    
    // Handle process exit
    parlantProcess.on('exit', (code, signal) => {
      if (code === 0) {
        console.log('Parlant service exited successfully');
      } else {
        console.error(`Parlant service exited with code ${code}, signal ${signal}`);
      }
    });
    
    // Handle process errors
    parlantProcess.on('error', (error) => {
      console.error('Failed to start Parlant service:', error.message);
    });
    
    // Store reference for cleanup
    (global as any).parlantProcess = parlantProcess;
    
    // Wait a moment for the service to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test the service is running
    try {
      const response = await axios.get(`http://127.0.0.1:${process.env.PARLANT_PORT}/health`, {
        timeout: 5000
      });
      console.log("✅ Parlant service is running and healthy:", response.data);
    } catch (error) {
      console.log("⚠️  Parlant service may not be fully ready yet, will retry connections automatically");
    }
    
  } catch (error) {
    console.error('Error starting Parlant service:', error);
    throw error;
  }
}

// Initialize sample data for testing
async function initializeSampleData() {
  try {
    const existingAdmins = await storage.getAdminUsers();
    if (existingAdmins.length > 0) {
      return; // Sample data already initialized
    }

    console.log("Initializing sample data...");

    // Create sample admin user
    await storage.upsertUser({
      id: "admin-sample-123",
      email: "admin@familyportal.com",
      firstName: "Portal",
      lastName: "Administrator",
      role: "admin",
      familyId: null,
    });

    // Create sample family
    const sampleFamily = await storage.createFamily({
      name: "Johnson Family",
      familyCode: "JOHNSON2024",
    });

    // Create sample family member
    await storage.upsertUser({
      id: "family-sample-456",
      email: "mary@johnson.com",
      firstName: "Mary",
      lastName: "Johnson",
      role: "family",
      familyId: sampleFamily.id,
    });

    console.log(`Sample data initialized: Family ${sampleFamily.name} with code ${sampleFamily.familyCode}`);
  } catch (error) {
    console.error("Error initializing sample data:", error);
  }
}

// Initialize default tasks from the PDF checklist
async function initializeDefaultTasks() {
  try {
    const existingTasks = await storage.getAllTasks();
    if (existingTasks.length > 0) {
      return; // Tasks already initialized
    }

    const defaultTasks = [
      {
        title: "Secured Party Creditor (SPC) Paperwork",
        description: "UCC-1 Financing Statement and Security Agreement to reclaim ownership over your ALL CAPS NAME",
        category: "paperwork",
        order: 1,
        isTemplate: true,
      },
      {
        title: "Private Banking Trust Formation",
        description: "Establish an Ecclesiastical or Family Trust to own assets and control contracts",
        category: "paperwork",
        order: 2,
        isTemplate: true,
      },
      {
        title: "DS-11 Passport Application + Explanatory Letter",
        description: "Declare Non-Citizen National Status under 8 U.S.C. § 1101(a)(21)",
        category: "applications",
        order: 3,
        isTemplate: true,
      },
      {
        title: "FOIA Requests (SSA, DOS, USCIS)",
        description: "Obtain proof of federal classification to support status correction",
        category: "applications",
        order: 4,
        isTemplate: true,
      },
      {
        title: "USCIS Self-Check via E-Verify",
        description: "Discover administrative citizenship status and create a rebuttable record",
        category: "applications",
        order: 5,
        isTemplate: true,
      },
      {
        title: "SF-181 Racial Identification Form",
        description: "Correct racial classification to 'American Indian' to reassert indigenous origin",
        category: "documents",
        order: 6,
        isTemplate: true,
      },
      {
        title: "SS-5 Citizenship Status Update",
        description: "Reclassify SSA records from 'U.S. Citizen' to 'Other – Non-Citizen National'",
        category: "documents",
        order: 7,
        isTemplate: true,
      },
      {
        title: "Birth Certificate Authentication via Department of State",
        description: "Elevate the birth record to international status for use in trust and sovereignty claims",
        category: "documents",
        order: 8,
        isTemplate: true,
      },
      {
        title: "TreasuryDirect Account Setup",
        description: "Access the bonded estate to acknowledge and reclaim beneficial control",
        category: "applications",
        order: 9,
        isTemplate: true,
      },
      {
        title: "World Passport",
        description: "Establish lawful international identity under human rights law",
        category: "documents",
        order: 10,
        isTemplate: true,
      },
    ];

    for (const taskData of defaultTasks) {
      await storage.createTask(taskData);
    }

    console.log("Default tasks initialized successfully");
  } catch (error) {
    console.error("Error initializing default tasks:", error);
  }
}
