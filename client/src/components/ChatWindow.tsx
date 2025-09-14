import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Send, 
  ArrowLeft,
  Users,
  MoreVertical,
  Clock
} from "lucide-react";
import { format, isToday, isYesterday, formatDistanceToNow } from "date-fns";

interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: string;
}

interface ChatRoom {
  id: string;
  name: string;
  type: 'family' | 'inter-family';
  familyId?: string;
  connectionId?: string;
  participants: number;
}

interface ChatWindowProps {
  room: ChatRoom;
  messages: ChatMessage[];
  typingUsers: Set<string>;
  onSendMessage: (content: string) => void;
  onTyping: (isTyping: boolean) => void;
  onBack?: () => void;
  isLoading?: boolean;
  currentUserId: string;
}

export default function ChatWindow({
  room,
  messages,
  typingUsers,
  onSendMessage,
  onTyping,
  onBack,
  isLoading = false,
  currentUserId,
}: ChatWindowProps) {
  const [messageInput, setMessageInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle typing indicator
  useEffect(() => {
    if (messageInput && !isTyping) {
      setIsTyping(true);
      onTyping(true);
    } else if (!messageInput && isTyping) {
      setIsTyping(false);
      onTyping(false);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator
    if (messageInput) {
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        onTyping(false);
      }, 1000);
    }

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [messageInput]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isTyping) {
        onTyping(false);
      }
    };
  }, []);

  const handleSendMessage = () => {
    if (messageInput.trim()) {
      onSendMessage(messageInput.trim());
      setMessageInput("");
      textareaRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    
    if (isToday(date)) {
      return format(date, "h:mm a");
    } else if (isYesterday(date)) {
      return `Yesterday ${format(date, "h:mm a")}`;
    } else {
      return format(date, "MMM d, h:mm a");
    }
  };

  const getMessageGroupDate = (timestamp: string) => {
    const date = new Date(timestamp);
    
    if (isToday(date)) {
      return "Today";
    } else if (isYesterday(date)) {
      return "Yesterday";
    } else {
      return format(date, "EEEE, MMMM d, yyyy");
    }
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = getMessageGroupDate(message.timestamp);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {} as Record<string, ChatMessage[]>);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              data-testid="button-back"
              className="md:hidden"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              {room.name}
              {room.participants > 0 && (
                <Badge variant="outline" className="text-xs">
                  <Users className="w-3 h-3 mr-1" />
                  {room.participants} online
                </Badge>
              )}
            </h3>
            {typingUsers.size > 0 && (
              <p className="text-sm text-muted-foreground animate-pulse">
                {Array.from(typingUsers).join(", ")} {typingUsers.size === 1 ? "is" : "are"} typing...
              </p>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          data-testid="button-room-options"
        >
          <MoreVertical className="w-5 h-5" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-16 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <Users className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              No messages yet. Start the conversation!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedMessages).map(([date, dateMessages]) => (
              <div key={date}>
                {/* Date Separator */}
                <div className="flex items-center justify-center my-4">
                  <div className="flex-1 border-t border-border" />
                  <Badge variant="outline" className="mx-3 text-xs">
                    {date}
                  </Badge>
                  <div className="flex-1 border-t border-border" />
                </div>

                {/* Messages for this date */}
                <div className="space-y-3">
                  {dateMessages.map((message, index) => {
                    const isCurrentUser = message.userId === currentUserId;
                    const showAvatar = index === 0 || 
                      dateMessages[index - 1]?.userId !== message.userId;

                    return (
                      <div
                        key={message.id}
                        className={cn(
                          "flex gap-3",
                          isCurrentUser && "flex-row-reverse"
                        )}
                        data-testid={`message-${message.id}`}
                      >
                        {showAvatar ? (
                          <Avatar className="w-8 h-8 flex-shrink-0">
                            <AvatarFallback className={cn(
                              "text-xs",
                              isCurrentUser ? "bg-primary text-primary-foreground" : "bg-secondary"
                            )}>
                              {message.userName.split(" ").map(n => n[0]).join("").toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="w-8 h-8 flex-shrink-0" />
                        )}

                        <div className={cn(
                          "flex flex-col gap-1 max-w-[70%]",
                          isCurrentUser && "items-end"
                        )}>
                          {showAvatar && (
                            <div className={cn(
                              "flex items-center gap-2 text-xs",
                              isCurrentUser && "flex-row-reverse"
                            )}>
                              <span className="font-medium">{message.userName}</span>
                              <span className="text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatMessageTime(message.timestamp)}
                              </span>
                            </div>
                          )}
                          
                          <div className={cn(
                            "px-3 py-2 rounded-lg break-words",
                            isCurrentUser 
                              ? "bg-primary text-primary-foreground" 
                              : "bg-secondary"
                          )}>
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Message Input */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
            className="min-h-[60px] max-h-[120px] resize-none"
            data-testid="input-message"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!messageInput.trim()}
            size="icon"
            className="h-[60px] w-[60px]"
            data-testid="button-send"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}