import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface EmailProvider {
  sendEmail(options: EmailOptions): Promise<EmailResult>;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class NodemailerProvider implements EmailProvider {
  private transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    try {
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      console.error('Failed to send email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export class DevConsoleProvider implements EmailProvider {
  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    console.log('=== EMAIL NOTIFICATION (DEV MODE) ===');
    console.log('To:', options.to);
    console.log('Subject:', options.subject);
    console.log('Text:', options.text || 'No text version');
    console.log('HTML:', options.html);
    console.log('=====================================');

    return {
      success: true,
      messageId: `dev-${Date.now()}`,
    };
  }
}

// Factory function to create the appropriate provider
export function createEmailProvider(): EmailProvider {
  // Use nodemailer if SMTP credentials are configured
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    return new NodemailerProvider();
  }
  
  // Fallback to console logging
  return new DevConsoleProvider();
}