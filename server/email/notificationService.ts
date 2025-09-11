import { storage } from "../storage";
import { createEmailProvider } from "./provider";
import { generateTaskStatusChangedEmail } from "./templates/taskStatusChanged";
import { generateDocumentUploadedEmail } from "./templates/documentUploaded";
import { generateAdminMessageEmail } from "./templates/adminMessage";
import { generateInvitationEmail } from "./templates/invitation";
import type { User, FamilyTask, Task, Document, Message, Invitation, Family } from "@shared/schema";

export class NotificationService {
  private emailProvider = createEmailProvider();

  // Generic method to resolve recipients for family notifications
  private async resolveFamilyRecipients(familyId: string, excludeUserId?: string): Promise<User[]> {
    const familyMembers = await storage.getFamilyMembers(familyId);
    const admins = await storage.getAdminUsers();
    
    // Combine family members and admins, excluding the actor
    const allRecipients = [...familyMembers, ...admins];
    const uniqueRecipients = allRecipients.filter((user, index, array) => 
      array.findIndex(u => u.id === user.id) === index && 
      user.id !== excludeUserId &&
      user.email // Only include users with email addresses
    );
    
    return uniqueRecipients;
  }

  // Check if user should receive this type of notification
  private async shouldReceiveNotification(userId: string, notificationType: string): Promise<boolean> {
    const preferences = await storage.getUserNotificationPreferences(userId);
    
    // Default to true if no preferences set
    if (!preferences) {
      return true;
    }

    switch (notificationType) {
      case 'task':
        return preferences.emailOnTaskStatus ?? true;
      case 'document':
        return preferences.emailOnDocumentUpload ?? true;
      case 'message':
        return preferences.emailOnAdminMessage ?? true;
      case 'invitation':
        return preferences.emailOnInvitations ?? true;
      default:
        return false;
    }
  }

  // Check for recent notifications to prevent spam (5-minute rate limit)
  private async isRecentlySent(type: string, recipientUserId: string, entityId: string): Promise<boolean> {
    const recentLog = await storage.findRecentNotificationLog(type, recipientUserId, entityId, 5);
    return !!recentLog;
  }

  // Check for recent notifications by email (for invitations)
  private async isRecentlySentByEmail(type: string, recipientEmail: string, entityId: string): Promise<boolean> {
    const recentLog = await storage.findRecentNotificationLogByEmail(type, recipientEmail, entityId, 5);
    return !!recentLog;
  }

  // Send email and log the result
  private async sendEmailWithLogging(
    recipient: User, 
    type: string, 
    entityId: string, 
    familyId: string | null,
    subject: string, 
    html: string, 
    text: string
  ): Promise<void> {
    try {
      const result = await this.emailProvider.sendEmail({
        to: recipient.email!,
        subject,
        html,
        text
      });

      await storage.createNotificationLog({
        type,
        recipientUserId: recipient.id,
        recipientEmail: recipient.email!,
        familyId,
        entityId,
        status: result.success ? 'sent' : 'failed',
        error: result.error || null
      });

      if (!result.success) {
        console.error(`Failed to send ${type} notification to ${recipient.email}:`, result.error);
      }
    } catch (error) {
      console.error(`Error sending ${type} notification to ${recipient.email}:`, error);
      
      await storage.createNotificationLog({
        type,
        recipientUserId: recipient.id,
        recipientEmail: recipient.email!,
        familyId,
        entityId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Task status change notification
  async queueTaskStatusChange(
    familyTask: FamilyTask & { task: Task },
    family: Family,
    updatedBy: User,
    oldStatus: string
  ): Promise<void> {
    try {
      const recipients = await this.resolveFamilyRecipients(family.id, updatedBy.id);
      
      for (const recipient of recipients) {
        // Check user preferences
        if (!await this.shouldReceiveNotification(recipient.id, 'task')) {
          continue;
        }
        
        // Check for recent notifications
        if (await this.isRecentlySent('task', recipient.id, familyTask.id)) {
          continue;
        }

        const { subject, html, text } = generateTaskStatusChangedEmail({
          task: familyTask.task,
          familyTask,
          family,
          updatedBy,
          newStatus: familyTask.status,
          oldStatus
        });

        // Send async without awaiting to avoid blocking
        this.sendEmailWithLogging(recipient, 'task', familyTask.id, family.id, subject, html, text);
      }
    } catch (error) {
      console.error('Error queuing task status change notifications:', error);
    }
  }

  // Document upload notification
  async queueDocumentUpload(
    document: Document,
    uploader: User,
    family: Family,
    familyTask?: FamilyTask & { task: Task }
  ): Promise<void> {
    try {
      const recipients = await this.resolveFamilyRecipients(family.id, uploader.id);
      
      for (const recipient of recipients) {
        // Check user preferences
        if (!await this.shouldReceiveNotification(recipient.id, 'document')) {
          continue;
        }
        
        // Check for recent notifications
        if (await this.isRecentlySent('document', recipient.id, document.id)) {
          continue;
        }

        const { subject, html, text } = generateDocumentUploadedEmail({
          document,
          uploader,
          family,
          familyTask
        });

        // Send async without awaiting to avoid blocking
        this.sendEmailWithLogging(recipient, 'document', document.id, family.id, subject, html, text);
      }
    } catch (error) {
      console.error('Error queuing document upload notifications:', error);
    }
  }

  // Admin message notification
  async queueAdminMessage(
    message: Message,
    fromUser: User,
    family: Family
  ): Promise<void> {
    try {
      // For admin messages, only notify family members (not other admins)
      const familyMembers = await storage.getFamilyMembers(family.id);
      const recipients = familyMembers.filter(user => 
        user.id !== fromUser.id && user.email
      );
      
      for (const recipient of recipients) {
        // Check user preferences
        if (!await this.shouldReceiveNotification(recipient.id, 'message')) {
          continue;
        }
        
        // Check for recent notifications
        if (await this.isRecentlySent('message', recipient.id, message.id)) {
          continue;
        }

        const { subject, html, text } = generateAdminMessageEmail({
          message,
          fromUser,
          family
        });

        // Send async without awaiting to avoid blocking
        this.sendEmailWithLogging(recipient, 'message', message.id, family.id, subject, html, text);
      }
    } catch (error) {
      console.error('Error queuing admin message notifications:', error);
    }
  }

  // Invitation notification
  async queueInvitation(
    invitation: Invitation,
    inviter: User,
    family: Family
  ): Promise<void> {
    try {
      // Check for recent notifications by email to prevent spam
      if (await this.isRecentlySentByEmail('invitation', invitation.inviteeEmail, invitation.id)) {
        console.log(`Skipping invitation email to ${invitation.inviteeEmail} - recently sent`);
        return;
      }

      // For invitations, we send directly to the invitee email (may not be a user yet)
      const { subject, html, text } = generateInvitationEmail({
        invitation,
        inviter,
        family
      });

      // Send the invitation email
      const result = await this.emailProvider.sendEmail({
        to: invitation.inviteeEmail,
        subject,
        html,
        text
      });

      // Log the result (recipient user id will be null since they may not be a user yet)
      await storage.createNotificationLog({
        type: 'invitation',
        recipientUserId: null, // No user ID for invitations
        recipientEmail: invitation.inviteeEmail, // Store email in proper field
        familyId: family.id,
        entityId: invitation.id,
        status: result.success ? 'sent' : 'failed',
        error: result.error || null
      });

      if (!result.success) {
        console.error(`Failed to send invitation to ${invitation.inviteeEmail}:`, result.error);
      }
    } catch (error) {
      console.error('Error queuing invitation notification:', error);
      
      await storage.createNotificationLog({
        type: 'invitation',
        recipientUserId: null, // No user ID for invitations
        recipientEmail: invitation.inviteeEmail, // Store email in proper field
        familyId: family.id,
        entityId: invitation.id,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();