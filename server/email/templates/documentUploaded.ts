import type { Document, User, Family, FamilyTask, Task } from "@shared/schema";

export interface DocumentUploadedData {
  document: Document;
  uploader: User;
  family: Family;
  familyTask?: FamilyTask & { task: Task };
}

export function generateDocumentUploadedEmail(data: DocumentUploadedData): { subject: string; html: string; text: string } {
  const { document, uploader, family, familyTask } = data;
  
  const subject = `New document uploaded: ${document.originalFileName}`;
  
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
            <h1 style="color: #1f2937; margin: 0 0 10px 0; font-size: 24px;">Document Uploaded</h1>
            <p style="color: #6b7280; margin: 0; font-size: 14px;">Family Portal Notification</p>
          </div>
          
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
            <h2 style="color: #1f2937; margin: 0 0 15px 0;">${document.originalFileName}</h2>
            
            <div style="margin: 15px 0;">
              <p><strong>Family:</strong> ${family.name}</p>
              <p><strong>Uploaded by:</strong> ${uploader.firstName} ${uploader.lastName}</p>
              <p><strong>File size:</strong> ${(document.fileSize / 1024 / 1024).toFixed(2)} MB</p>
              <p><strong>Type:</strong> ${document.mimeType}</p>
              ${familyTask ? `<p><strong>Related to task:</strong> ${familyTask.task.title}</p>` : ''}
            </div>
            
            <div style="margin: 20px 0; padding: 15px; background: #f0f9ff; border-radius: 6px; border-left: 4px solid #3b82f6;">
              <p style="margin: 0; color: #1e40af;">
                📄 A new document has been uploaded to your family's portal.
              </p>
            </div>
            
            <div style="margin: 25px 0;">
              <a href="${process.env.VITE_APP_URL || 'http://localhost:5000'}/" 
                 style="background: #3b82f6; color: white; padding: 12px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Documents
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
Document Uploaded - ${family.name}

File: ${document.originalFileName}
Uploaded by: ${uploader.firstName} ${uploader.lastName}
File size: ${(document.fileSize / 1024 / 1024).toFixed(2)} MB
Type: ${document.mimeType}

${familyTask ? `Related to task: ${familyTask.task.title}` : ''}

A new document has been uploaded to your family's portal.

View Documents: ${process.env.VITE_APP_URL || 'http://localhost:5000'}/

Manage notification preferences: ${process.env.VITE_APP_URL || 'http://localhost:5000'}/notifications
  `;

  return { subject, html, text };
}