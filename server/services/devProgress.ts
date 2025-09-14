import axios, { AxiosInstance, AxiosError } from "axios";

/**
 * Developer Progress Service
 * 
 * This service is designed for developers to report project progress to clients
 * via Dart in natural, client-friendly language. It focuses on communicating
 * development updates, not syncing operational data.
 */

interface ProgressUpdate {
  summary: string;
  added?: string[];
  fixed?: string[];
  improved?: string[];
  nextSteps?: string[];
  metadata?: Record<string, any>;
}

interface UpdateSection {
  title: string;
  items: string[];
}

export class DevProgressService {
  private apiKey: string;
  private workspaceId: string = 'LTPknvYLuLH9'; // Dart workspace ID
  private projectId: string = 'UDY98NgvnZ4z'; // Dart project ID
  private baseUrl = 'https://app.itsdart.com/api/v0';
  private axiosInstance: AxiosInstance;
  private static instance: DevProgressService;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.DART_API_KEY || '';
    this.workspaceId = process.env.DART_WORKSPACE_ID || 'LTPknvYLuLH9';
    this.projectId = process.env.DART_PROJECT_ID || 'UDY98NgvnZ4z';
    
    if (!this.apiKey) {
      console.warn('[DevProgress] API key not configured. Service will be disabled.');
    }

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      response => response,
      async error => {
        console.error('[DevProgress] API request failed:', this.formatError(error));
        throw error;
      }
    );
  }

  // Singleton pattern
  public static getInstance(apiKey?: string): DevProgressService {
    if (!DevProgressService.instance) {
      DevProgressService.instance = new DevProgressService(apiKey);
    }
    return DevProgressService.instance;
  }

  // Check if service is configured
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Send a natural language update to Dart
   * @param message The formatted message to send
   * @param metadata Optional metadata for the update
   */
  async sendUpdate(message: string, metadata?: Record<string, any>): Promise<boolean> {
    if (!this.isConfigured()) {
      console.error('[DevProgress] Cannot send update - API key not configured');
      return false;
    }

    try {
      // Send update to Dart project
      const response = await this.axiosInstance.post(`/projects/${this.projectId}/updates`, {
        message,
        metadata: {
          type: 'development_progress',
          timestamp: new Date().toISOString(),
          ...metadata,
        },
      });

      console.log('[DevProgress] Update sent successfully');
      return true;
    } catch (error) {
      console.error('[DevProgress] Failed to send update:', this.formatError(error));
      return false;
    }
  }

  /**
   * Compose a natural language update from sections
   * @param update The update sections to compose
   * @returns The formatted message
   */
  composeUpdate(update: ProgressUpdate): string {
    const lines: string[] = [];
    const date = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    // Header
    lines.push(`📊 Development Progress Update`);
    lines.push(`${date}`);
    lines.push('');
    
    // Executive Summary
    if (update.summary) {
      lines.push('**Executive Summary**');
      lines.push(update.summary);
      lines.push('');
    }
    
    // What's New
    if (update.added && update.added.length > 0) {
      lines.push('✨ **What\'s New**');
      update.added.forEach(item => {
        lines.push(`• ${item}`);
      });
      lines.push('');
    }
    
    // Improvements
    if (update.improved && update.improved.length > 0) {
      lines.push('🚀 **Improvements**');
      update.improved.forEach(item => {
        lines.push(`• ${item}`);
      });
      lines.push('');
    }
    
    // Bug Fixes
    if (update.fixed && update.fixed.length > 0) {
      lines.push('🐛 **Bug Fixes**');
      update.fixed.forEach(item => {
        lines.push(`• ${item}`);
      });
      lines.push('');
    }
    
    // Next Steps
    if (update.nextSteps && update.nextSteps.length > 0) {
      lines.push('📅 **Next Steps**');
      update.nextSteps.forEach(item => {
        lines.push(`• ${item}`);
      });
      lines.push('');
    }
    
    // Footer
    lines.push('---');
    lines.push('*This update was generated automatically from the development team.*');
    
    return lines.join('\n');
  }

  /**
   * Send a composed progress update
   * @param update The update sections
   * @returns Success status
   */
  async sendProgressUpdate(update: ProgressUpdate): Promise<boolean> {
    const message = this.composeUpdate(update);
    const metadata = {
      summary: update.summary,
      addedCount: update.added?.length || 0,
      fixedCount: update.fixed?.length || 0,
      improvedCount: update.improved?.length || 0,
      ...update.metadata,
    };
    
    return this.sendUpdate(message, metadata);
  }

  /**
   * Get service status
   * @returns Status information
   */
  async status(): Promise<{
    configured: boolean;
    workspaceId: string;
    projectId: string;
    apiEndpoint: string;
  }> {
    return {
      configured: this.isConfigured(),
      workspaceId: this.workspaceId,
      projectId: this.projectId,
      apiEndpoint: this.baseUrl,
    };
  }

  /**
   * Format error for logging
   */
  private formatError(error: any): string {
    if (error instanceof AxiosError) {
      if (error.response) {
        return `Status ${error.response.status}: ${JSON.stringify(error.response.data)}`;
      } else if (error.request) {
        return `No response received: ${error.message}`;
      } else {
        return `Request setup error: ${error.message}`;
      }
    }
    return error instanceof Error ? error.message : 'Unknown error';
  }

  /**
   * Preview an update without sending
   * @param update The update to preview
   * @returns The formatted message
   */
  previewUpdate(update: ProgressUpdate): string {
    const message = this.composeUpdate(update);
    const wordCount = message.split(/\s+/).length;
    
    if (wordCount > 300) {
      console.warn(`[DevProgress] Warning: Update is ${wordCount} words (recommended: under 300)`);
    }
    
    return message;
  }
}

// Export singleton instance
export const devProgress = DevProgressService.getInstance();