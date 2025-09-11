import type { Task, FamilyTask, User, Family } from "@shared/schema";

export interface TaskStatusChangedData {
  task: Task;
  familyTask: FamilyTask;
  family: Family;
  updatedBy: User;
  newStatus: string;
  oldStatus: string;
}

export function generateTaskStatusChangedEmail(data: TaskStatusChangedData): { subject: string; html: string; text: string } {
  const { task, family, updatedBy, newStatus, oldStatus } = data;
  
  const subject = `Task "${task.title}" status changed to ${newStatus}`;
  
  const statusColors: Record<string, string> = {
    'not_started': '#6B7280',
    'in_progress': '#F59E0B', 
    'completed': '#10B981'
  };

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
            <h1 style="color: #1f2937; margin: 0 0 10px 0; font-size: 24px;">Task Status Update</h1>
            <p style="color: #6b7280; margin: 0; font-size: 14px;">Family Portal Notification</p>
          </div>
          
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
            <h2 style="color: #1f2937; margin: 0 0 15px 0;">${task.title}</h2>
            
            <div style="margin: 15px 0;">
              <p><strong>Family:</strong> ${family.name}</p>
              <p><strong>Category:</strong> ${task.category}</p>
              ${task.description ? `<p><strong>Description:</strong> ${task.description}</p>` : ''}
            </div>
            
            <div style="margin: 20px 0; padding: 15px; background: #f9fafb; border-radius: 6px;">
              <p style="margin: 0;">
                <strong>Status changed:</strong> 
                <span style="color: ${statusColors[oldStatus] || '#6B7280'}; text-transform: capitalize;">${oldStatus.replace('_', ' ')}</span>
                <span style="margin: 0 10px;">→</span>
                <span style="color: ${statusColors[newStatus] || '#6B7280'}; font-weight: bold; text-transform: capitalize;">${newStatus.replace('_', ' ')}</span>
              </p>
              <p style="margin: 5px 0 0 0; color: #6b7280;">Updated by: ${updatedBy.firstName} ${updatedBy.lastName}</p>
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
Task Status Update - ${family.name}

Task: ${task.title}
Status changed from "${oldStatus.replace('_', ' ')}" to "${newStatus.replace('_', ' ')}"
Updated by: ${updatedBy.firstName} ${updatedBy.lastName}

${task.description ? `Description: ${task.description}` : ''}

View in Portal: ${process.env.VITE_APP_URL || 'http://localhost:5000'}/

Manage notification preferences: ${process.env.VITE_APP_URL || 'http://localhost:5000'}/notifications
  `;

  return { subject, html, text };
}