import type { Message, User, Family } from "@shared/schema";

export interface AdminMessageData {
  message: Message;
  fromUser: User;
  family: Family;
}

export function generateAdminMessageEmail(data: AdminMessageData): { subject: string; html: string; text: string } {
  const { message, fromUser, family } = data;
  
  const subject = `Message from admin: ${message.subject}`;
  
  const messageTypeColors: Record<string, string> = {
    'info': '#3b82f6',
    'warning': '#f59e0b',
    'success': '#10b981',
    'error': '#ef4444'
  };

  const messageTypeIcons: Record<string, string> = {
    'info': 'ℹ️',
    'warning': '⚠️',
    'success': '✅',
    'error': '❌'
  };

  const typeColor = messageTypeColors[message.messageType || 'info'] || '#3b82f6';
  const typeIcon = messageTypeIcons[message.messageType || 'info'] || 'ℹ️';
  
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
            <h1 style="color: #1f2937; margin: 0 0 10px 0; font-size: 24px;">Admin Message</h1>
            <p style="color: #6b7280; margin: 0; font-size: 14px;">Family Portal Notification</p>
          </div>
          
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
            <div style="margin-bottom: 15px; padding: 12px; background: ${typeColor}15; border-left: 4px solid ${typeColor}; border-radius: 4px;">
              <p style="margin: 0; color: ${typeColor}; font-weight: bold;">
                ${typeIcon} ${(message.messageType || 'info').toUpperCase()}
              </p>
            </div>
            
            <h2 style="color: #1f2937; margin: 0 0 15px 0;">${message.subject}</h2>
            
            <div style="margin: 15px 0;">
              <p><strong>From:</strong> ${fromUser.firstName} ${fromUser.lastName} (Admin)</p>
              <p><strong>To:</strong> ${family.name} family</p>
            </div>
            
            <div style="margin: 20px 0; padding: 20px; background: #f9fafb; border-radius: 6px;">
              <div style="white-space: pre-wrap; line-height: 1.6;">${message.content}</div>
            </div>
            
            <div style="margin: 25px 0;">
              <a href="${process.env.VITE_APP_URL || 'http://localhost:5000'}/" 
                 style="background: #3b82f6; color: white; padding: 12px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View in Portal
              </a>
            </div>
          </div>
          
          <div style="margin-top: 20px; padding: 15px; color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb;">
            <p>You received this notification because you're a member of the ${family.name} family.</p>
            <p><a href="${process.env.VITE_APP_URL || 'http://localhost:5000'}/notifications" style="color: #3b82f6;">Manage notification preferences</a></p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
Admin Message - ${family.name}

${(message.messageType || 'info').toUpperCase()}: ${message.subject}

From: ${fromUser.firstName} ${fromUser.lastName} (Admin)
To: ${family.name} family

Message:
${message.content}

View in Portal: ${process.env.VITE_APP_URL || 'http://localhost:5000'}/

Manage notification preferences: ${process.env.VITE_APP_URL || 'http://localhost:5000'}/notifications
  `;

  return { subject, html, text };
}