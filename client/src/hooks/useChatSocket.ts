import { useEffect, useRef, useCallback, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: string;
}

interface TypingIndicator {
  roomId: string;
  userId: string;
  userName: string;
  isTyping: boolean;
}

interface ConnectionEvent {
  type: 'connected' | 'disconnected';
  familyId: string;
  familyName: string;
  connectionId: string;
}

export function useChatSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Map<string, Set<string>>>(new Map());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const typingTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Initialize socket connection
  useEffect(() => {
    if (!user) return;

    const socket = io("/", {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    // Connection events
    socket.on("connect", () => {
      console.log("Connected to chat server");
      setIsConnected(true);
      
      // Rejoin active room if any
      if (activeRoom) {
        socket.emit("chat:join", { roomId: activeRoom });
      }
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from chat server");
      setIsConnected(false);
    });

    socket.on("error", (error: any) => {
      console.error("Socket error:", error);
      toast({
        title: "Connection Error",
        description: "Failed to connect to chat server",
        variant: "destructive",
      });
    });

    // Chat events
    socket.on("chat:message", (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on("chat:typing", (data: TypingIndicator) => {
      const { roomId, userId, userName, isTyping } = data;
      
      setTypingUsers((prev) => {
        const newMap = new Map(prev);
        const roomTypers = newMap.get(roomId) || new Set();
        
        if (isTyping && userId !== user.id) {
          roomTypers.add(userName);
        } else {
          roomTypers.delete(userName);
        }
        
        if (roomTypers.size === 0) {
          newMap.delete(roomId);
        } else {
          newMap.set(roomId, roomTypers);
        }
        
        return newMap;
      });

      // Clear typing indicator after 3 seconds
      if (isTyping && userId !== user.id) {
        const timeoutKey = `${roomId}-${userId}`;
        const existingTimeout = typingTimeoutRef.current.get(timeoutKey);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }
        
        const timeout = setTimeout(() => {
          setTypingUsers((prev) => {
            const newMap = new Map(prev);
            const roomTypers = newMap.get(roomId) || new Set();
            roomTypers.delete(userName);
            
            if (roomTypers.size === 0) {
              newMap.delete(roomId);
            } else {
              newMap.set(roomId, roomTypers);
            }
            
            return newMap;
          });
        }, 3000);
        
        typingTimeoutRef.current.set(timeoutKey, timeout);
      }
    });

    socket.on("chat:room_joined", ({ roomId, userId }) => {
      if (userId === user.id) {
        console.log(`Joined room: ${roomId}`);
      }
    });

    socket.on("chat:room_left", ({ roomId, userId }) => {
      if (userId === user.id) {
        console.log(`Left room: ${roomId}`);
      }
    });

    socket.on("chat:connection", (event: ConnectionEvent) => {
      toast({
        title: event.type === 'connected' ? "Family Connected" : "Family Disconnected",
        description: `${event.familyName} ${event.type === 'connected' ? 'is now connected' : 'has disconnected'}`,
        variant: event.type === 'connected' ? 'default' : 'destructive',
      });
    });

    return () => {
      // Clean up timeouts
      typingTimeoutRef.current.forEach(timeout => clearTimeout(timeout));
      typingTimeoutRef.current.clear();
      
      if (socket) {
        socket.disconnect();
      }
    };
  }, [user, toast, activeRoom]);

  // Join a chat room
  const joinRoom = useCallback((roomId: string) => {
    if (socketRef.current && isConnected) {
      // Leave current room if any
      if (activeRoom && activeRoom !== roomId) {
        socketRef.current.emit("chat:leave", { roomId: activeRoom });
      }
      
      // Join new room
      socketRef.current.emit("chat:join", { roomId });
      setActiveRoom(roomId);
      
      // Clear messages when switching rooms
      setMessages([]);
    }
  }, [isConnected, activeRoom]);

  // Leave a chat room
  const leaveRoom = useCallback((roomId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit("chat:leave", { roomId });
      if (activeRoom === roomId) {
        setActiveRoom(null);
        setMessages([]);
      }
    }
  }, [isConnected, activeRoom]);

  // Send a message
  const sendMessage = useCallback((roomId: string, content: string) => {
    if (socketRef.current && isConnected && content.trim()) {
      socketRef.current.emit("chat:message", {
        roomId,
        content: content.trim(),
      });
    }
  }, [isConnected]);

  // Send typing indicator
  const sendTypingIndicator = useCallback((roomId: string, isTyping: boolean) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit("chat:typing", {
        roomId,
        isTyping,
      });
    }
  }, [isConnected]);

  // Generate connection code
  const generateConnectionCode = useCallback(async (): Promise<string | null> => {
    try {
      const response = await fetch("/api/chat/connection/generate", {
        method: "POST",
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to generate connection code");
      }
      
      const data = await response.json();
      return data.code;
    } catch (error) {
      console.error("Error generating connection code:", error);
      toast({
        title: "Error",
        description: "Failed to generate connection code",
        variant: "destructive",
      });
      return null;
    }
  }, [toast]);

  // Accept connection code
  const acceptConnectionCode = useCallback(async (code: string): Promise<boolean> => {
    try {
      const response = await fetch("/api/chat/connection/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to accept connection code");
      }
      
      toast({
        title: "Success",
        description: "Family connection established",
      });
      
      return true;
    } catch (error: any) {
      console.error("Error accepting connection code:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to accept connection code",
        variant: "destructive",
      });
      return false;
    }
  }, [toast]);

  // Revoke a connection
  const revokeConnection = useCallback(async (connectionId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/chat/connection/${connectionId}`, {
        method: "DELETE",
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to revoke connection");
      }
      
      toast({
        title: "Success",
        description: "Connection revoked successfully",
      });
      
      return true;
    } catch (error) {
      console.error("Error revoking connection:", error);
      toast({
        title: "Error",
        description: "Failed to revoke connection",
        variant: "destructive",
      });
      return false;
    }
  }, [toast]);

  return {
    isConnected,
    messages,
    typingUsers,
    activeRoom,
    joinRoom,
    leaveRoom,
    sendMessage,
    sendTypingIndicator,
    generateConnectionCode,
    acceptConnectionCode,
    revokeConnection,
  };
}