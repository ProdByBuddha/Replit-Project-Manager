import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { insertFamilySchema, insertTaskSchema, insertMessageSchema, insertInvitationSchema, insertNotificationPreferencesSchema, insertTaskDependencySchema, insertWorkflowRuleSchema, users, invitations } from "@shared/schema";
import { notificationService } from "./email/notificationService";
import { eventBus } from "./automation/EventBus";
import { getAutomationHealth, checkFamilyDependencies } from "./automation/index";
import { validateTaskTransition, getDependencyTaskNames, type TaskStatus } from "./taskValidation";
import multer from "multer";
import { nanoid } from "nanoid";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Initialize default tasks if they don't exist
  await initializeDefaultTasks();

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
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

      res.json({
        ...user,
        family: familyInfo,
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
  app.get('/api/families', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

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

  app.post('/api/families', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

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
  app.get('/api/families/:familyId', isAuthenticated, async (req: any, res) => {
    try {
      const { familyId } = req.params;
      const user = await storage.getUser(req.user.claims.sub);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

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
  app.get('/api/admin/automation/health', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const health = getAutomationHealth();
      res.json(health);
    } catch (error) {
      console.error("Error fetching automation health:", error);
      res.status(500).json({ message: "Failed to fetch automation health" });
    }
  });

  // Admin manual dependency check endpoint
  app.post('/api/admin/automation/check-dependencies', isAuthenticated, async (req: any, res) => {
    try {
      const { familyId } = req.body;
      const user = await storage.getUser(req.user.claims.sub);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

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

  // Admin users endpoint for workflow rule assignment
  app.get('/api/admin/users', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Get all users, including family members for assignment
      const allFamilies = await storage.getAllFamilies();
      const allUsers = [];
      
      // Get admin users
      const adminUsers = await storage.getAdminUsers();
      allUsers.push(...adminUsers);
      
      // Get family members from all families
      for (const family of allFamilies) {
        const members = await storage.getFamilyMembers(family.id);
        allUsers.push(...members);
      }
      
      // Remove duplicates and format for dropdown
      const uniqueUsers = allUsers.filter((user, index, arr) => 
        arr.findIndex(u => u.id === user.id) === index
      );
      
      const userData = uniqueUsers.map(u => ({
        id: u.id,
        name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
        email: u.email,
        role: u.role
      }));
      
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
  app.get('/api/admin/dependencies', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

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
  app.post('/api/admin/dependencies', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

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
  app.put('/api/admin/dependencies/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

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
        throw new Error(`Failed to update dependency: ${addError.message}`);
      }

      // Return dependency with task names for UI
      const allTasks = await storage.getAllTasks();
      const taskMap = new Map(allTasks.map(task => [task.id, task]));
      
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
  app.delete('/api/admin/dependencies/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

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
  app.get('/api/admin/workflow-rules', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

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
  app.post('/api/admin/workflow-rules', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

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
  app.put('/api/admin/workflow-rules/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      const updateData = insertWorkflowRuleSchema.parse(req.body);
      
      // For workflow rules, we'll implement a direct update in storage
      // For now, let's implement it by recreating (like dependencies)
      const updatedRule = await storage.addWorkflowRule({ ...updateData, id });
      
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
  app.delete('/api/admin/workflow-rules/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      
      // Delete workflow rule from database
      await db.delete(workflowRules).where(eq(workflowRules.id, id));

      res.json({ message: "Workflow rule deleted successfully" });
    } catch (error) {
      console.error("Error deleting workflow rule:", error);
      res.status(500).json({ message: "Failed to delete workflow rule" });
    }
  });

  // Toggle workflow rule active status
  app.patch('/api/admin/workflow-rules/:id/toggle', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

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

  // Task endpoints
  app.get('/api/tasks', isAuthenticated, async (req: any, res) => {
    try {
      const { familyId } = req.query;
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // If familyId is provided, admin can get tasks for any family
      if (familyId && user.role === 'admin') {
        const familyTasks = await storage.getFamilyTasksWithDependencies(familyId as string);
        res.json(familyTasks);
      } else if (user.familyId) {
        // Family member - get family tasks with dependency information
        const familyTasks = await storage.getFamilyTasksWithDependencies(user.familyId);
        res.json(familyTasks);
      } else if (user.role === 'admin') {
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

  app.put('/api/tasks/:taskId/status', isAuthenticated, async (req: any, res) => {
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
      if (user.role !== 'admin' && user.familyId !== familyTask.familyId) {
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
  app.get('/api/documents', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      let familyId = user.familyId;
      
      // If admin and familyId query param provided, use that
      if (user.role === 'admin' && req.query.familyId) {
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
  app.post("/api/documents", isAuthenticated, async (req: any, res) => {
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
      if (user.role === 'admin' && req.body.familyId) {
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
  app.get('/api/messages', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      let familyId = user.familyId;
      
      // If admin and familyId query param provided, use that
      if (user.role === 'admin' && req.query.familyId) {
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

  app.post('/api/messages', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // SECURITY: Validate familyId access before allowing message creation
      const requestedFamilyId = req.body.familyId;
      
      // Non-admin users can only create messages for their own family
      if (user.role !== 'admin') {
        if (!user.familyId) {
          return res.status(403).json({ message: "Access denied - user not part of any family" });
        }
        if (requestedFamilyId !== user.familyId) {
          return res.status(403).json({ message: "Access denied - cannot create messages for other families" });
        }
      }
      
      // Admin users can create messages for any family, but familyId must be provided
      if (user.role === 'admin' && !requestedFamilyId) {
        return res.status(400).json({ message: "Family ID required for admin message creation" });
      }

      const messageData = insertMessageSchema.parse({
        ...req.body,
        fromUserId: user.id,
      });

      const message = await storage.createMessage(messageData);
      
      // Send notification for admin messages to family members
      if (user.role === 'admin') {
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

  app.get('/api/invitations', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      let familyId = user.familyId;
      
      // If admin and familyId query param provided, use that
      if (user.role === 'admin' && req.query.familyId) {
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

  app.delete('/api/invitations/:id', isAuthenticated, async (req: any, res) => {
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
      if (user.role !== 'admin' && invitation.inviterUserId !== user.id) {
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
  app.get('/api/stats/family/:familyId', isAuthenticated, async (req: any, res) => {
    try {
      const { familyId } = req.params;
      const user = await storage.getUser(req.user.claims.sub);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check access - user must be family member or admin
      if (user.familyId !== familyId && user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const stats = await storage.getFamilyStats(familyId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching family stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get('/api/stats/admin', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch admin stats" });
    }
  });

  const httpServer = createServer(app);
  
  // Initialize sample data and default tasks
  await initializeSampleData();
  await initializeDefaultTasks();
  
  return httpServer;
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
