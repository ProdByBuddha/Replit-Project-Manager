import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import type { Express } from "express";
import { storage } from "./storage";
import { nanoid } from "nanoid";
import { getSession } from "./replitAuth";

// Define Socket types with authentication data
interface SocketUser {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  familyId?: string;
  role: string;
}

interface AuthenticatedSocket extends Socket {
  user?: SocketUser;
}

import type { Socket } from "socket.io";

let io: Server | null = null;

export function initializeWebSocket(server: HttpServer, app: Express): Server {
  console.log("[WebSocket] Initializing Socket.IO server...");
  
  // Get domain from environment
  const domains = process.env.REPLIT_DOMAINS?.split(",") || [];
  const corsOrigins = domains.map(domain => `https://${domain}`);
  
  io = new Server(server, {
    cors: {
      origin: corsOrigins.length > 0 ? corsOrigins : ["https://localhost:5000"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // Wire up Express session middleware to Socket.IO
  const sessionMiddleware = getSession();
  
  // Wrap session middleware for Socket.IO
  io.engine.use((req: any, res: any, next: any) => {
    sessionMiddleware(req, res, next);
  });

  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      // Access session from the socket request
      const session = (socket.request as any).session;
      
      if (!session?.passport?.user?.claims?.sub) {
        console.log("[WebSocket] Authentication failed: No user session");
        return next(new Error("Authentication required"));
      }

      const userId = session.passport.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        console.log(`[WebSocket] Authentication failed: User ${userId} not found`);
        return next(new Error("User not found"));
      }

      // Attach user to socket for future use
      socket.user = {
        id: user.id,
        email: user.email || undefined,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        familyId: user.familyId || undefined,
        role: user.role,
      };

      console.log(`[WebSocket] User ${user.id} authenticated successfully`);
      next();
    } catch (error) {
      console.error("[WebSocket] Authentication error:", error);
      next(new Error("Authentication failed"));
    }
  });

  // Connection handler
  io.on("connection", async (socket: AuthenticatedSocket) => {
    if (!socket.user) {
      console.error("[WebSocket] Connection without authenticated user");
      socket.disconnect();
      return;
    }

    const userId = socket.user.id;
    const familyId = socket.user.familyId;
    
    console.log(`[WebSocket] User ${userId} connected (family: ${familyId})`);

    // Auto-join user to their family chat room if they belong to a family
    if (familyId) {
      // Join family-specific room
      socket.join(`family:${familyId}`);
      console.log(`[WebSocket] User ${userId} joined family room: family:${familyId}`);

      // Join all accessible inter-family rooms
      try {
        const rooms = await storage.getRoomsForFamily(familyId);
        for (const room of rooms) {
          socket.join(`room:${room.id}`);
          console.log(`[WebSocket] User ${userId} joined room: ${room.id}`);
        }
      } catch (error) {
        console.error(`[WebSocket] Error loading rooms for family ${familyId}:`, error);
      }
    }

    // Event handlers
    
    // Handle sending messages
    socket.on("chat:send", async (data: { roomId: string; content: string }, callback) => {
      try {
        if (!socket.user || !socket.user.id) {
          return callback({ success: false, error: "Not authenticated" });
        }

        const { roomId, content } = data;

        if (!roomId || !content?.trim()) {
          return callback({ success: false, error: "Invalid message data" });
        }

        // Validate room access
        const canAccess = await storage.canAccessRoom(socket.user.id, roomId);
        if (!canAccess) {
          console.log(`[WebSocket] User ${socket.user.id} denied access to room ${roomId}`);
          return callback({ success: false, error: "Access denied" });
        }

        // Save message to database
        const message = await storage.createMessage(roomId, socket.user.id, content.trim());

        // Prepare message with sender info for broadcast
        const messageWithSender = {
          ...message,
          sender: {
            id: socket.user.id,
            firstName: socket.user.firstName,
            lastName: socket.user.lastName,
            email: socket.user.email,
          },
        };

        // Broadcast to room
        io.to(`room:${roomId}`).emit("chat:message", messageWithSender);
        
        console.log(`[WebSocket] Message sent in room ${roomId} by user ${socket.user.id}`);
        callback({ success: true, message: messageWithSender });
      } catch (error) {
        console.error("[WebSocket] Error sending message:", error);
        callback({ success: false, error: "Failed to send message" });
      }
    });

    // Handle typing indicators
    socket.on("chat:typing", async (data: { roomId: string; isTyping: boolean }) => {
      try {
        if (!socket.user || !socket.user.id) {
          return;
        }

        const { roomId, isTyping } = data;

        // Validate room access
        const canAccess = await storage.canAccessRoom(socket.user.id, roomId);
        if (!canAccess) {
          return;
        }

        // Broadcast typing indicator to others in the room
        socket.to(`room:${roomId}`).emit("chat:typing", {
          userId: socket.user.id,
          userName: `${socket.user.firstName || ""} ${socket.user.lastName || ""}`.trim() || socket.user.email,
          isTyping,
        });
      } catch (error) {
        console.error("[WebSocket] Error handling typing indicator:", error);
      }
    });

    // Handle joining specific rooms
    socket.on("chat:joinRoom", async (data: { roomId: string }, callback) => {
      try {
        if (!socket.user || !socket.user.id) {
          return callback({ success: false, error: "Not authenticated" });
        }

        const { roomId } = data;

        // Validate room access
        const canAccess = await storage.canAccessRoom(socket.user.id, roomId);
        if (!canAccess) {
          console.log(`[WebSocket] User ${socket.user.id} denied access to room ${roomId}`);
          return callback({ success: false, error: "Access denied" });
        }

        // Join the room
        socket.join(`room:${roomId}`);
        console.log(`[WebSocket] User ${socket.user.id} joined room ${roomId}`);
        
        callback({ success: true });
      } catch (error) {
        console.error("[WebSocket] Error joining room:", error);
        callback({ success: false, error: "Failed to join room" });
      }
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log(`[WebSocket] User ${userId} disconnected`);
    });

    // Error handling
    socket.on("error", (error) => {
      console.error(`[WebSocket] Socket error for user ${userId}:`, error);
    });
  });

  console.log("[WebSocket] Socket.IO server initialized successfully");
  return io;
}

// Export function to emit events from other parts of the application
export function emitToRoom(roomId: string, event: string, data: any) {
  if (!io) {
    console.error("[WebSocket] Socket.IO server not initialized");
    return;
  }
  
  io.to(`room:${roomId}`).emit(event, data);
}

export function emitToFamily(familyId: string, event: string, data: any) {
  if (!io) {
    console.error("[WebSocket] Socket.IO server not initialized");
    return;
  }
  
  io.to(`family:${familyId}`).emit(event, data);
}

export function getIO(): Server | null {
  return io;
}