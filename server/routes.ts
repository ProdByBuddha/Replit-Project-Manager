import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { insertFamilySchema, insertTaskSchema, insertMessageSchema } from "@shared/schema";
import multer from "multer";

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

  // Task endpoints
  app.get('/api/tasks', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.familyId) {
        // Family member - get family tasks
        const familyTasks = await storage.getFamilyTasks(user.familyId);
        res.json(familyTasks);
      } else if (user.role === 'admin') {
        // Admin - get template tasks
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
      if (!user?.familyId) {
        return res.status(403).json({ message: "Family member access required" });
      }

      const updatedTask = await storage.updateFamilyTaskStatus(taskId, status, notes);
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

      const messageData = insertMessageSchema.parse({
        ...req.body,
        fromUserId: user.id,
      });

      const message = await storage.createMessage(messageData);
      res.status(201).json(message);
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(500).json({ message: "Failed to create message" });
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
      name: "Portal Administrator",
      role: "admin",
      familyId: null,
    });

    // Create sample family
    const sampleFamily = await storage.createFamily({
      name: "Johnson Family",
      familyCode: "JOHNSON2024",
      contactEmail: "johnson@example.com",
    });

    // Create sample family member
    await storage.upsertUser({
      id: "family-sample-456",
      email: "mary@johnson.com",
      name: "Mary Johnson",
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
