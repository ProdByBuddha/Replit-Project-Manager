import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useChatSocket } from "@/hooks/useChatSocket";
import { useAuth } from "@/hooks/useAuth";
import ChatSidebar from "@/components/ChatSidebar";
import ChatWindow from "@/components/ChatWindow";
import ConnectionModal from "@/components/ConnectionModal";
import PortalLayout from "@/components/PortalLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Users } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ChatRoom {
  id: string;
  name: string;
  type: 'family' | 'inter-family';
  familyId?: string;
  connectionId?: string;
  lastMessage?: {
    content: string;
    timestamp: string;
    userName: string;
  };
  unreadCount: number;
  participants: number;
}

interface ChatConnection {
  id: string;
  familyId1: string;
  familyId2: string;
  family1Name: string;
  family2Name: string;
  createdAt: string;
  status: 'active' | 'pending';
}

export default function ChatPage() {
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);
  const [showSidebar, setShowSidebar] = useState(!isMobileView);
  
  const { user } = useAuth();
  const {
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
  } = useChatSocket();

  // Fetch chat rooms
  const { data: rooms = [], isLoading: roomsLoading, refetch: refetchRooms } = useQuery<ChatRoom[]>({
    queryKey: ["/api/chat/rooms"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch connections
  const { data: connections = [], refetch: refetchConnections } = useQuery<ChatConnection[]>({
    queryKey: ["/api/chat/connections"],
  });

  // Fetch message history when room changes
  const { data: messageHistory = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["/api/chat/messages", selectedRoom?.id],
    enabled: !!selectedRoom,
  });

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      setIsMobileView(isMobile);
      if (!isMobile) {
        setShowSidebar(true);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Join room when selected
  useEffect(() => {
    if (selectedRoom) {
      joinRoom(selectedRoom.id);
    }
  }, [selectedRoom, joinRoom]);

  // Handle room selection
  const handleRoomSelect = (room: ChatRoom) => {
    setSelectedRoom(room);
    if (isMobileView) {
      setShowSidebar(false);
    }
  };

  // Handle back button on mobile
  const handleBackToSidebar = () => {
    setShowSidebar(true);
    setSelectedRoom(null);
  };

  // Calculate total unread messages
  const totalUnread = rooms.reduce((sum, room) => sum + room.unreadCount, 0);

  return (
    <PortalLayout pageTitle="Chat">
      <div className="h-[calc(100vh-8rem)] flex flex-col">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <MessageSquare className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-chat-title">Family Chat</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Connect and communicate with your family
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {totalUnread > 0 && (
              <Badge variant="destructive" data-testid="badge-unread-total">
                {totalUnread} unread
              </Badge>
            )}
            <Badge variant={isConnected ? "success" : "secondary"} data-testid="badge-connection-status">
              {isConnected ? "Connected" : "Disconnected"}
            </Badge>
          </div>
        </div>

        {/* Main Chat Container */}
        <Card className="flex-1 overflow-hidden">
          <div className="flex h-full">
            {/* Sidebar */}
            <div className={cn(
              "border-r border-border transition-all duration-300",
              isMobileView ? (showSidebar ? "w-full" : "w-0 overflow-hidden") : "w-80"
            )}>
              <ChatSidebar
                rooms={rooms}
                connections={connections}
                selectedRoom={selectedRoom}
                onRoomSelect={handleRoomSelect}
                onConnectionClick={() => setShowConnectionModal(true)}
                isLoading={roomsLoading}
                isMobileView={isMobileView}
              />
            </div>

            {/* Chat Window */}
            <div className={cn(
              "flex-1 transition-all duration-300",
              isMobileView && showSidebar && "hidden"
            )}>
              {selectedRoom ? (
                <ChatWindow
                  room={selectedRoom}
                  messages={[...messageHistory, ...messages.filter(m => m.roomId === selectedRoom.id)]}
                  typingUsers={typingUsers.get(selectedRoom.id) || new Set()}
                  onSendMessage={(content) => sendMessage(selectedRoom.id, content)}
                  onTyping={(isTyping) => sendTypingIndicator(selectedRoom.id, isTyping)}
                  onBack={isMobileView ? handleBackToSidebar : undefined}
                  isLoading={messagesLoading}
                  currentUserId={user?.id || ""}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <MessageSquare className="w-16 h-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No chat selected</h3>
                  <p className="text-muted-foreground mb-4">
                    Select a chat room from the sidebar to start messaging
                  </p>
                  {isMobileView && (
                    <Button
                      onClick={() => setShowSidebar(true)}
                      variant="outline"
                      data-testid="button-show-rooms"
                    >
                      <Users className="w-4 h-4 mr-2" />
                      Show Rooms
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Connection Modal */}
        <ConnectionModal
          open={showConnectionModal}
          onOpenChange={setShowConnectionModal}
          connections={connections}
          onGenerateCode={generateConnectionCode}
          onAcceptCode={acceptConnectionCode}
          onRevokeConnection={async (connectionId) => {
            const success = await revokeConnection(connectionId);
            if (success) {
              refetchConnections();
              refetchRooms();
            }
            return success;
          }}
        />
      </div>
    </PortalLayout>
  );
}