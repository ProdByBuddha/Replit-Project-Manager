import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Copy, 
  Check, 
  RefreshCw, 
  Link2, 
  Trash2,
  Users,
  Clock,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";

interface ChatConnection {
  id: string;
  familyId1: string;
  familyId2: string;
  family1Name: string;
  family2Name: string;
  createdAt: string;
  status: 'active' | 'pending';
}

interface ConnectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connections: ChatConnection[];
  onGenerateCode: () => Promise<string | null>;
  onAcceptCode: (code: string) => Promise<boolean>;
  onRevokeConnection: (connectionId: string) => Promise<boolean>;
}

export default function ConnectionModal({
  open,
  onOpenChange,
  connections,
  onGenerateCode,
  onAcceptCode,
  onRevokeConnection,
}: ConnectionModalProps) {
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [acceptCode, setAcceptCode] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [connectionToRevoke, setConnectionToRevoke] = useState<ChatConnection | null>(null);
  const { toast } = useToast();

  const handleGenerateCode = async () => {
    setIsGenerating(true);
    try {
      const code = await onGenerateCode();
      if (code) {
        setGeneratedCode(code);
        setCopiedCode(false);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyCode = () => {
    if (generatedCode) {
      navigator.clipboard.writeText(generatedCode);
      setCopiedCode(true);
      toast({
        title: "Code Copied",
        description: "Connection code copied to clipboard",
      });
      setTimeout(() => setCopiedCode(false), 3000);
    }
  };

  const handleAcceptCode = async () => {
    if (!acceptCode.trim()) return;
    
    setIsAccepting(true);
    try {
      const success = await onAcceptCode(acceptCode);
      if (success) {
        setAcceptCode("");
        onOpenChange(false);
      }
    } finally {
      setIsAccepting(false);
    }
  };

  const handleRevokeConnection = async () => {
    if (!connectionToRevoke) return;
    
    const success = await onRevokeConnection(connectionToRevoke.id);
    if (success) {
      setConnectionToRevoke(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5" />
              Family Connections
            </DialogTitle>
            <DialogDescription>
              Connect with other families to enable inter-family chat
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="connect" className="mt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="connect">Connect</TabsTrigger>
              <TabsTrigger value="accept">Accept</TabsTrigger>
              <TabsTrigger value="manage">
                Manage ({connections.length})
              </TabsTrigger>
            </TabsList>

            {/* Generate Connection Code */}
            <TabsContent value="connect" className="space-y-4 mt-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Generate a connection code to share with another family. 
                  The code will expire in 24 hours.
                </p>
                
                {!generatedCode ? (
                  <Button
                    onClick={handleGenerateCode}
                    disabled={isGenerating}
                    data-testid="button-generate-code"
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Link2 className="w-4 h-4 mr-2" />
                        Generate Connection Code
                      </>
                    )}
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-secondary rounded-lg">
                      <Label className="text-xs text-muted-foreground">
                        Connection Code (expires in 24 hours)
                      </Label>
                      <div className="flex items-center justify-center gap-2 mt-2">
                        <code className="text-2xl font-mono font-bold tracking-wider">
                          {generatedCode}
                        </code>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={handleCopyCode}
                          data-testid="button-copy-code"
                        >
                          {copiedCode ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 justify-center">
                      <Button
                        variant="outline"
                        onClick={() => setGeneratedCode(null)}
                        data-testid="button-new-code"
                      >
                        Generate New Code
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Accept Connection Code */}
            <TabsContent value="accept" className="space-y-4 mt-4">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Enter a connection code from another family to establish a connection.
                </p>
                
                <div className="space-y-2">
                  <Label htmlFor="accept-code">Connection Code</Label>
                  <Input
                    id="accept-code"
                    value={acceptCode}
                    onChange={(e) => setAcceptCode(e.target.value.toUpperCase())}
                    placeholder="Enter 6-character code"
                    maxLength={6}
                    className="font-mono text-center text-lg tracking-wider"
                    data-testid="input-accept-code"
                  />
                </div>
                
                <Button
                  onClick={handleAcceptCode}
                  disabled={acceptCode.length !== 6 || isAccepting}
                  className="w-full"
                  data-testid="button-accept-code"
                >
                  {isAccepting ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Link2 className="w-4 h-4 mr-2" />
                      Accept Connection
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            {/* Manage Connections */}
            <TabsContent value="manage" className="mt-4">
              {connections.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">
                    No active connections yet
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {connections.map((connection) => (
                      <div
                        key={connection.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                        data-testid={`connection-${connection.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <Users className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">
                              {connection.family1Name} ↔ {connection.family2Name}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              Connected {format(new Date(connection.createdAt), "MMM d, yyyy")}
                              <Badge variant={connection.status === 'active' ? 'success' : 'secondary'}>
                                {connection.status}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setConnectionToRevoke(connection)}
                          data-testid={`button-revoke-${connection.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Revoke Connection Confirmation */}
      <AlertDialog 
        open={!!connectionToRevoke} 
        onOpenChange={() => setConnectionToRevoke(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              Revoke Connection
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke the connection with{" "}
              <span className="font-medium">
                {connectionToRevoke?.family1Name} ↔ {connectionToRevoke?.family2Name}
              </span>
              ? This will remove chat access between the families.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeConnection}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke Connection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}