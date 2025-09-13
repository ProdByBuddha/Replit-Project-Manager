import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  MessageCircle, 
  X, 
  Send, 
  Loader2, 
  Minimize2,
  Maximize2,
  HelpCircle,
  FileText,
  Home,
  Building
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types for chat functionality
interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

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

// Widget states
type WidgetState = 'closed' | 'open' | 'minimized';

// Page context mapping
const getPageContext = (location: string) => {
  if (location === '/' || location === '/home') return 'home';
  if (location === '/status-correction') return 'status_correction';
  if (location === '/ministry-legitimation') return 'ministry_legitimation';
  if (location === '/notifications') return 'notifications';
  return 'general';
};

// Contextual starter prompts
const getStarterPrompts = (pageContext: string) => {
  switch (pageContext) {
    case 'home':
      return [
        "What tasks should I focus on first?",
        "How do I upload documents?",
        "What's my family's current progress?"
      ];
    case 'status_correction':
      return [
        "What documents do I need for status correction?",
        "How long does the process take?",
        "What are the next steps in my case?"
      ];
    case 'ministry_legitimation':
      return [
        "What is ministry legitimization?",
        "Which documents are required first?",
        "How do I set up banking for my ministry?"
      ];
    case 'notifications':
      return [
        "How do I manage my notification preferences?",
        "What do these message types mean?",
        "How do I mark messages as read?"
      ];
    default:
      return [
        "How can I help you today?",
        "Tell me about the family portal",
        "What should I do next?"
      ];
  }
};

const getPageIcon = (pageContext: string) => {
  switch (pageContext) {
    case 'home': return <Home className="w-4 h-4" />;
    case 'status_correction': return <FileText className="w-4 h-4" />;
    case 'ministry_legitimation': return <Building className="w-4 h-4" />;
    default: return <HelpCircle className="w-4 h-4" />;
  }
};

const getPageTitle = (pageContext: string) => {
  switch (pageContext) {
    case 'home': return 'Family Portal Help';
    case 'status_correction': return 'Status Correction Help';
    case 'ministry_legitimation': return 'Ministry Legitimation Help';
    case 'notifications': return 'Notifications Help';
    default: return 'AI Assistant';
  }
};

export default function ChatWidget() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [widgetState, setWidgetState] = useState<WidgetState>('closed');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sessionId, setSessionId] = useState<string>('');
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pageContext = getPageContext(location);
  const starterPrompts = getStarterPrompts(pageContext);
  
  // Initialize session ID
  useEffect(() => {
    if (!sessionId) {
      setSessionId(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    }
  }, [sessionId]);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Focus input when opening
  useEffect(() => {
    if (widgetState === 'open' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [widgetState]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && widgetState !== 'closed') {
        setWidgetState('closed');
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [widgetState]);

  // Chat mutation
  const chatMutation = useMutation({
    mutationFn: async (chatRequest: ChatRequest): Promise<ChatResponse> => {
      const response = await apiRequest('POST', '/api/ai/chat', chatRequest);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        const assistantMessage: ChatMessage = {
          id: `assistant_${Date.now()}`,
          content: data.response,
          role: 'assistant',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
        
        // Update session ID
        if (data.session_id) {
          setSessionId(data.session_id);
        }
        
        // Show notification if widget is minimized
        if (widgetState === 'minimized' || widgetState === 'closed') {
          setHasNewMessages(true);
        }
      } else {
        // Handle error response
        const errorMessage: ChatMessage = {
          id: `error_${Date.now()}`,
          content: data.error || "I'm sorry, I encountered an error. Please try again.",
          role: 'assistant',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    },
    onError: (error) => {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}`,
        content: "I'm having trouble connecting. Please check your internet connection and try again.",
        role: 'assistant',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  });

  const handleSendMessage = (content: string) => {
    if (!content.trim()) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      content: content.trim(),
      role: 'user',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    
    // Clear input
    setInputMessage('');
    
    // Send to API with context
    const chatRequest: ChatRequest = {
      message: content.trim(),
      session_id: sessionId,
      context: {
        user_role: user?.role,
        family_id: user?.familyId || undefined,
        current_page: pageContext,
        user_name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email
      }
    };
    
    chatMutation.mutate(chatRequest);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(inputMessage);
  };

  const handlePromptClick = (prompt: string) => {
    handleSendMessage(prompt);
  };

  const handleWidgetToggle = () => {
    if (widgetState === 'closed') {
      setWidgetState('open');
      setHasNewMessages(false);
    } else if (widgetState === 'open') {
      setWidgetState('closed');
    } else {
      setWidgetState('open');
      setHasNewMessages(false);
    }
  };

  const handleMinimize = () => {
    setWidgetState('minimized');
  };

  const handleMaximize = () => {
    setWidgetState('open');
    setHasNewMessages(false);
  };

  if (!user) return null;

  return (
    <>
      {/* Floating Button */}
      {(widgetState === 'closed' || widgetState === 'minimized') && (
        <div className="fixed bottom-4 right-4 z-50">
          <Button
            onClick={handleWidgetToggle}
            size="icon"
            className={cn(
              "h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300",
              "bg-primary hover:bg-primary/90 text-primary-foreground",
              widgetState === 'minimized' && "bg-secondary hover:bg-secondary/80"
            )}
            data-testid="button-chat-widget-toggle"
          >
            <MessageCircle className="h-6 w-6" />
            {hasNewMessages && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                data-testid="badge-new-messages"
              >
                !
              </Badge>
            )}
          </Button>
        </div>
      )}

      {/* Chat Interface */}
      {widgetState === 'open' && (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <Card className="w-96 h-96 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] shadow-2xl border-2">
            {/* Header */}
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center space-x-2">
                {getPageIcon(pageContext)}
                <CardTitle className="text-sm font-medium" data-testid="text-chat-title">
                  {getPageTitle(pageContext)}
                </CardTitle>
              </div>
              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleMinimize}
                  data-testid="button-minimize-chat"
                >
                  <Minimize2 className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setWidgetState('closed')}
                  data-testid="button-close-chat"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>

            {/* Messages */}
            <CardContent className="flex flex-col h-72">
              <ScrollArea className="flex-1 pr-4" data-testid="scroll-messages">
                {messages.length === 0 ? (
                  <div className="space-y-3" data-testid="starter-prompts">
                    <p className="text-sm text-muted-foreground mb-3">
                      Hi! I'm here to help you with the family portal. Try asking:
                    </p>
                    {starterPrompts.map((prompt, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        className="w-full justify-start h-auto p-2 text-xs text-left whitespace-normal"
                        onClick={() => handlePromptClick(prompt)}
                        data-testid={`button-starter-prompt-${index}`}
                      >
                        {prompt}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={cn(
                          "flex",
                          message.role === 'user' ? 'justify-end' : 'justify-start'
                        )}
                        data-testid={`message-${message.role}-${message.id}`}
                      >
                        <div
                          className={cn(
                            "max-w-[80%] rounded-lg p-2 text-sm",
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          <p className="whitespace-pre-wrap">{message.content}</p>
                          <p className="text-xs opacity-70 mt-1">
                            {message.timestamp.toLocaleTimeString([], { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                    
                    {/* Typing indicator */}
                    {chatMutation.isPending && (
                      <div className="flex justify-start" data-testid="typing-indicator">
                        <div className="bg-muted text-muted-foreground rounded-lg p-2 text-sm flex items-center space-x-2">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>AI is typing...</span>
                        </div>
                      </div>
                    )}
                    
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Input */}
              <form onSubmit={handleSubmit} className="mt-3 flex space-x-2" data-testid="form-chat-input">
                <Input
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Type your message..."
                  disabled={chatMutation.isPending}
                  className="flex-1"
                  data-testid="input-chat-message"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!inputMessage.trim() || chatMutation.isPending}
                  data-testid="button-send-message"
                >
                  {chatMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}