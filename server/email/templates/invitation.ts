import type { Invitation, User, Family } from "@shared/schema";

export interface InvitationData {
  invitation: Invitation;
  inviter: User;
  family: Family;
}

export function generateInvitationEmail(data: InvitationData): { subject: string; html: string; text: string } {
  const { invitation, inviter, family } = data;
  
  const subject = `Invitation to join ${family.name} on Family Portal`;
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h1 style="color: #1f2937; margin: 0 0 10px 0; font-size: 24px;">Family Portal Invitation</h1>
            <p style="color: #6b7280; margin: 0; font-size: 14px;">You've been invited to join a family portal</p>
          </div>
          
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
            <h2 style="color: #1f2937; margin: 0 0 15px 0;">Welcome to ${family.name}!</h2>
            
            <div style="margin: 20px 0; padding: 20px; background: #f0f9ff; border-radius: 6px; border-left: 4px solid #3b82f6;">
              <p style="margin: 0 0 10px 0; color: #1e40af; font-size: 16px;">
                🎉 You've been invited by ${inviter.firstName} ${inviter.lastName} to join the ${family.name} family portal.
              </p>
              <p style="margin: 0; color: #1e40af;">
                This secure portal will help you track your family's progress through important tasks and documentation.
              </p>
            </div>
            
            <div style="margin: 25px 0;">
              <p><strong>Invitation Code:</strong> <code style="background: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${invitation.invitationCode}</code></p>
              <p><strong>Expires:</strong> ${new Date(invitation.expiresAt).toLocaleDateString()}</p>
            </div>
            
            <div style="margin: 25px 0;">
              <p>To get started:</p>
              <ol>
                <li>Click the link below to access the portal</li>
                <li>Sign in with your Replit account</li>
                <li>Use the invitation code above to join the family</li>
              </ol>
            </div>
            
            <div style="margin: 25px 0;">
              <a href="${process.env.VITE_APP_URL || 'http://localhost:5000'}/invitation/${invitation.invitationCode}" 
                 style="background: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-size: 16px; font-weight: bold;">
                Accept Invitation
              </a>
            </div>
            
            <div style="margin: 25px 0; padding: 15px; background: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 4px;">
              <p style="margin: 0; color: #92400e;">
                <strong>Important:</strong> This invitation will expire on ${new Date(invitation.expiresAt).toLocaleDateString()} at ${new Date(invitation.expiresAt).toLocaleTimeString()}.
              </p>
            </div>
          </div>
          
          <div style="margin-top: 20px; padding: 15px; color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb;">
            <p>If you have any questions about this invitation, please contact ${inviter.firstName} ${inviter.lastName} directly.</p>
            <p>If you don't want to receive these invitations, please ignore this email.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
Family Portal Invitation

You've been invited to join ${family.name}!

${inviter.firstName} ${inviter.lastName} has invited you to join the ${family.name} family portal. This secure portal will help you track your family's progress through important tasks and documentation.

Invitation Code: ${invitation.invitationCode}
Expires: ${new Date(invitation.expiresAt).toLocaleDateString()} at ${new Date(invitation.expiresAt).toLocaleTimeString()}

To get started:
1. Visit: ${process.env.VITE_APP_URL || 'http://localhost:5000'}/invitation/${invitation.invitationCode}
2. Sign in with your Replit account
3. Use the invitation code to join the family

Direct link: ${process.env.VITE_APP_URL || 'http://localhost:5000'}/invitation/${invitation.invitationCode}

Important: This invitation will expire on ${new Date(invitation.expiresAt).toLocaleDateString()}.

If you have any questions about this invitation, please contact ${inviter.firstName} ${inviter.lastName} directly.
  `;

  return { subject, html, text };
}