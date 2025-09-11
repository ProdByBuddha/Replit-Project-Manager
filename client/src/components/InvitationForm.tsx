import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { UserPlus, Mail, Send } from "lucide-react";

const invitationFormSchema = z.object({
  inviteeEmail: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address")
    .max(255, "Email is too long"),
});

type InvitationFormData = z.infer<typeof invitationFormSchema>;

interface InvitationFormProps {
  className?: string;
}

export default function InvitationForm({ className }: InvitationFormProps) {
  const { toast } = useToast();

  const form = useForm<InvitationFormData>({
    resolver: zodResolver(invitationFormSchema),
    defaultValues: {
      inviteeEmail: "",
    },
  });

  const sendInvitationMutation = useMutation({
    mutationFn: async (data: InvitationFormData) => {
      const response = await apiRequest('POST', '/api/invitations', data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Invitation Sent",
        description: "Family invitation has been sent successfully!",
      });
      
      // Invalidate invitations cache
      queryClient.invalidateQueries({ 
        queryKey: ["/api/invitations"]
      });
      
      // Reset form
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InvitationFormData) => {
    sendInvitationMutation.mutate(data);
  };

  return (
    <Card className={`bg-card border-border ${className}`}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-card-foreground">
          <UserPlus className="h-5 w-5 text-primary" />
          Invite Family Member
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="inviteeEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-card-foreground">Email Address</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        {...field}
                        data-testid="input-invitee-email"
                        type="email"
                        placeholder="Enter email address to invite"
                        className="pl-10 bg-background border-input text-foreground"
                        disabled={sendInvitationMutation.isPending}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              data-testid="button-send-invitation"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90" 
              disabled={sendInvitationMutation.isPending}
            >
              {sendInvitationMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Invitation
                </>
              )}
            </Button>
          </form>
        </Form>

        <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
          <p>• The invited person will receive an email with instructions</p>
          <p>• Invitations expire after 7 days</p>
          <p>• You can cancel pending invitations if needed</p>
        </div>
      </CardContent>
    </Card>
  );
}