import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  MessageSquare, 
  Users, 
  Plus, 
  Link2,
  Home,
  Clock
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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

interface ChatSidebarProps {
  rooms: ChatRoom[];
  connections: ChatConnection[];
  selectedRoom: ChatRoom | null;
  onRoomSelect: (room: ChatRoom) => void;
  onConnectionClick: () => void;
  isLoading: boolean;
  isMobileView?: boolean;
}

export default function ChatSidebar({
  rooms,
  connections,
  selectedRoom,
  onRoomSelect,
  onConnectionClick,
  isLoading,
  isMobileView = false,
}: ChatSidebarProps) {
  // Separate family room from inter-family rooms
  const familyRoom = rooms.find(r => r.type === 'family');
  const interFamilyRooms = rooms.filter(r => r.type === 'inter-family');

  const RoomItem = ({ room }: { room: ChatRoom }) => {
    const isSelected = selectedRoom?.id === room.id;
    const Icon = room.type === 'family' ? Home : Users;
    
    return (
      <Button
        variant={isSelected ? "secondary" : "ghost"}
        className={cn(
          "w-full justify-start p-3 h-auto",
          isSelected && "bg-secondary"
        )}
        onClick={() => onRoomSelect(room)}
        data-testid={`button-room-${room.id}`}
      >
        <div className="flex items-start gap-3 w-full">
          <div className="relative flex-shrink-0">
            <Icon className="w-5 h-5 mt-0.5" />
            {room.unreadCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
              >
                {room.unreadCount > 9 ? '9+' : room.unreadCount}
              </Badge>
            )}
          </div>
          
          <div className="flex-1 text-left min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium truncate">{room.name}</p>
              {room.participants > 0 && (
                <Badge variant="outline" className="text-xs">
                  {room.participants} online
                </Badge>
              )}
            </div>
            
            {room.lastMessage && (
              <div className="mt-1">
                <p className="text-xs text-muted-foreground truncate">
                  <span className="font-medium">{room.lastMessage.userName}:</span>{' '}
                  {room.lastMessage.content}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3" />
                  {formatDistanceToNow(new Date(room.lastMessage.timestamp), { 
                    addSuffix: true 
                  })}
                </p>
              </div>
            )}
          </div>
        </div>
      </Button>
    );
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col p-4">
        <Skeleton className="h-10 w-full mb-4" />
        <Skeleton className="h-20 w-full mb-2" />
        <Skeleton className="h-20 w-full mb-2" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Chat Rooms
          </h2>
          <Button
            size="sm"
            variant="outline"
            onClick={onConnectionClick}
            data-testid="button-connect-family"
          >
            <Link2 className="w-4 h-4 mr-1" />
            Connect
          </Button>
        </div>
      </div>

      {/* Rooms List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {/* Family Room */}
          {familyRoom && (
            <div className="mb-4">
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase">
                Your Family
              </div>
              <RoomItem room={familyRoom} />
            </div>
          )}

          {/* Inter-Family Rooms */}
          {interFamilyRooms.length > 0 && (
            <>
              <Separator className="my-2" />
              <div className="mb-2">
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase">
                  Connected Families ({interFamilyRooms.length})
                </div>
                <div className="space-y-1">
                  {interFamilyRooms.map((room) => (
                    <RoomItem key={room.id} room={room} />
                  ))}
                </div>
              </div>
            </>
          )}

          {/* No Connections Message */}
          {interFamilyRooms.length === 0 && (
            <div className="mt-4 p-4 text-center">
              <Users className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-2">
                No family connections yet
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={onConnectionClick}
                className="w-full"
                data-testid="button-add-connection"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Connection
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Connection Status */}
      {connections.length > 0 && (
        <div className="p-3 border-t border-border">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{connections.length} active connections</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={onConnectionClick}
              data-testid="button-manage-connections"
            >
              Manage
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}