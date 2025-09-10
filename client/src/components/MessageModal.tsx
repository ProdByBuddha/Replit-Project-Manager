import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Send, AlertTriangle, CheckCircle, Info } from "lucide-react";
import type { Family } from "@shared/schema";

interface MessageModalProps {
  family: Family | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function MessageModal({ family, isOpen, onClose }: MessageModalProps) {
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [messageType, setMessageType] = useState("info");
  const { toast } = useToast();

  const sendMessageMutation = useMutation({
    mutationFn: async (data: {
      familyId: string;
      subject: string;
      content: string;
      messageType: string;
      toRole: string;
    }) => {
      const response = await apiRequest('POST', '/api/messages', data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Message sent to ${family?.name} successfully!`,
      });
      
      // Invalidate cache for this specific family
      queryClient.invalidateQueries({ 
        queryKey: ["/api/messages", family?.id]
      });
      
      // Also invalidate family stats since new messages affect stats
      queryClient.invalidateQueries({
        queryKey: [`/api/stats/family/${family?.id}`]
      });
      
      // Reset form and close modal
      setSubject("");
      setContent("");
      setMessageType("info");
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!family) {
      toast({
        title: "Error",
        description: "No family selected",
        variant: "destructive",
      });
      return;
    }

    if (!subject.trim() || !content.trim()) {
      toast({
        title: "Error", 
        description: "Subject and message content are required",
        variant: "destructive",
      });
      return;
    }

    sendMessageMutation.mutate({
      familyId: family.id,
      subject: subject.trim(),
      content: content.trim(),
      messageType,
      toRole: "family"
    });
  };

  const handleClose = () => {
    if (!sendMessageMutation.isPending) {
      setSubject("");
      setContent("");
      setMessageType("info");
      onClose();
    }
  };

  const getMessageTypeIcon = (type: string) => {
    switch (type) {
      case "success": return <CheckCircle className="w-4 h-4 text-chart-2" />;
      case "warning": return <AlertTriangle className="w-4 h-4 text-chart-3" />;
      case "error": return <AlertTriangle className="w-4 h-4 text-destructive" />;
      default: return <Info className="w-4 h-4 text-primary" />;
    }
  };

  if (!isOpen || !family) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3" data-testid="message-modal-title">
            <Send className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Send Message</h2>
              <p className="text-sm text-muted-foreground font-normal">
                To: {family.name} (Code: {family.familyCode})
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            {/* Message Type */}
            <div className="space-y-2">
              <Label htmlFor="messageType">Message Type</Label>
              <Select 
                value={messageType} 
                onValueChange={setMessageType}
                data-testid="select-message-type"
              >
                <SelectTrigger>
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      {getMessageTypeIcon(messageType)}
                      <span className="capitalize">{messageType}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info" data-testid="message-type-info">
                    <div className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-primary" />
                      Information
                    </div>
                  </SelectItem>
                  <SelectItem value="success" data-testid="message-type-success">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-chart-2" />
                      Success
                    </div>
                  </SelectItem>
                  <SelectItem value="warning" data-testid="message-type-warning">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-chart-3" />
                      Warning
                    </div>
                  </SelectItem>
                  <SelectItem value="error" data-testid="message-type-error">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-destructive" />
                      Important
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter message subject"
                disabled={sendMessageMutation.isPending}
                data-testid="input-subject"
                required
              />
            </div>

            {/* Message Content */}
            <div className="space-y-2">
              <Label htmlFor="content">Message *</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Type your message here..."
                rows={6}
                disabled={sendMessageMutation.isPending}
                data-testid="textarea-content"
                required
              />
              <p className="text-xs text-muted-foreground">
                This message will be visible to all members of the {family.name} family.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={sendMessageMutation.isPending}
              data-testid="button-cancel-message"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={sendMessageMutation.isPending || !subject.trim() || !content.trim()}
              data-testid="button-send-message"
            >
              {sendMessageMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-t-transparent border-current rounded-full animate-spin" />
                  Sending...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  Send Message
                </div>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}