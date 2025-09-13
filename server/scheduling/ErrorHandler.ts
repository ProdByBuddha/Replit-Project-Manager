/**
 * Enhanced Error Handling for US Code Scheduler
 * 
 * Provides robust error handling with:
 * - Exponential backoff for API errors
 * - Circuit breaker pattern for persistent failures
 * - Fallback strategies for service unavailability
 * - Detailed error logging and metrics
 */

import { log } from '../vite';

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // milliseconds
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number; // milliseconds
  monitorWindow: number; // milliseconds
}

export interface ErrorMetrics {
  totalErrors: number;
  apiErrors: number;
  timeoutErrors: number;
  circuitBreakerTrips: number;
  lastError: Date | null;
  errorRate: number; // errors per hour
}

class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failures = 0;
  private lastFailureTime: Date | null = null;
  private successCount = 0;

  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
        log('[CircuitBreaker] Attempting reset - state changed to HALF_OPEN');
      } else {
        throw new Error('Circuit breaker is OPEN - operation blocked');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return false;
    return Date.now() - this.lastFailureTime.getTime() >= this.config.resetTimeout;
  }

  private onSuccess(): void {
    this.failures = 0;
    this.successCount++;
    
    if (this.state === 'HALF_OPEN') {
      if (this.successCount >= 3) { // Require multiple successes to close
        this.state = 'CLOSED';
        this.successCount = 0;
        log('[CircuitBreaker] Circuit breaker reset - state changed to CLOSED');
      }
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = new Date();
    this.successCount = 0;

    if (this.failures >= this.config.failureThreshold) {
      this.state = 'OPEN';
      log(`[CircuitBreaker] Circuit breaker tripped - state changed to OPEN (${this.failures} failures)`);
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

export class EnhancedErrorHandler {
  private retryConfig: RetryConfig;
  private circuitBreaker: CircuitBreaker;
  private metrics: ErrorMetrics;
  private errorHistory: Array<{ timestamp: Date; error: string; type: string }> = [];

  constructor(
    retryConfig?: Partial<RetryConfig>,
    circuitBreakerConfig?: Partial<CircuitBreakerConfig>
  ) {
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: true,
      ...retryConfig,
    };

    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      monitorWindow: 300000, // 5 minutes
      ...circuitBreakerConfig,
    });

    this.metrics = {
      totalErrors: 0,
      apiErrors: 0,
      timeoutErrors: 0,
      circuitBreakerTrips: 0,
      lastError: null,
      errorRate: 0,
    };
  }

  /**
   * Execute operation with retry logic and circuit breaker protection
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    customRetryConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const config = { ...this.retryConfig, ...customRetryConfig };
    
    return this.circuitBreaker.execute(async () => {
      let lastError: Error;
      
      for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            const delay = this.calculateDelay(attempt, config);
            log(`[ErrorHandler] Retrying ${operationName} (attempt ${attempt + 1}/${config.maxRetries + 1}) after ${delay}ms`);
            await this.delay(delay);
          }

          const result = await operation();
          
          if (attempt > 0) {
            log(`[ErrorHandler] ${operationName} succeeded on attempt ${attempt + 1}`);
          }
          
          return result;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          this.recordError(lastError, operationName);

          if (attempt === config.maxRetries) {
            log(`[ErrorHandler] ${operationName} failed after ${config.maxRetries + 1} attempts: ${lastError.message}`);
            break;
          }

          if (!this.isRetryableError(lastError)) {
            log(`[ErrorHandler] ${operationName} failed with non-retryable error: ${lastError.message}`);
            break;
          }
        }
      }

      throw lastError!;
    });
  }

  /**
   * Check if an error should trigger a retry
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    
    // Network errors (retryable)
    if (message.includes('network') || 
        message.includes('timeout') || 
        message.includes('connection') ||
        message.includes('econnreset') ||
        message.includes('econnrefused')) {
      return true;
    }

    // HTTP 5xx errors (server errors - retryable)
    if (message.includes('500') || 
        message.includes('502') || 
        message.includes('503') || 
        message.includes('504')) {
      return true;
    }

    // Rate limit errors (retryable with longer delay)
    if (message.includes('rate limit') || 
        message.includes('429') ||
        message.includes('too many requests')) {
      return true;
    }

    // HTTP 4xx errors (client errors - usually not retryable)
    if (message.includes('400') || 
        message.includes('401') || 
        message.includes('403') || 
        message.includes('404')) {
      return false;
    }

    // Default to retryable for unknown errors
    return true;
  }

  /**
   * Calculate delay for exponential backoff
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt);
    
    // Cap at max delay
    delay = Math.min(delay, config.maxDelay);
    
    // Add jitter to avoid thundering herd
    if (config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }
    
    return Math.floor(delay);
  }

  /**
   * Record error for metrics and analysis
   */
  private recordError(error: Error, operationName: string): void {
    this.metrics.totalErrors++;
    this.metrics.lastError = new Date();

    const errorType = this.categorizeError(error);
    
    switch (errorType) {
      case 'api':
        this.metrics.apiErrors++;
        break;
      case 'timeout':
        this.metrics.timeoutErrors++;
        break;
      case 'circuit_breaker':
        this.metrics.circuitBreakerTrips++;
        break;
    }

    // Store in error history (keep last 100 errors)
    this.errorHistory.push({
      timestamp: new Date(),
      error: error.message,
      type: errorType,
    });
    
    if (this.errorHistory.length > 100) {
      this.errorHistory.shift();
    }

    // Update error rate (errors per hour)
    this.updateErrorRate();

    log(`[ErrorHandler] Recorded ${errorType} error for ${operationName}: ${error.message}`);
  }

  /**
   * Categorize error type for metrics
   */
  private categorizeError(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('circuit breaker')) return 'circuit_breaker';
    if (message.includes('api') || message.includes('http')) return 'api';
    
    return 'unknown';
  }

  /**
   * Update error rate calculation
   */
  private updateErrorRate(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentErrors = this.errorHistory.filter(entry => entry.timestamp > oneHourAgo);
    this.metrics.errorRate = recentErrors.length;
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current error metrics
   */
  getMetrics(): ErrorMetrics & { circuitBreakerState: any } {
    this.updateErrorRate();
    return {
      ...this.metrics,
      circuitBreakerState: this.circuitBreaker.getState(),
    };
  }

  /**
   * Get recent error history
   */
  getErrorHistory(limit: number = 20): Array<{ timestamp: Date; error: string; type: string }> {
    return this.errorHistory.slice(-limit);
  }

  /**
   * Reset metrics and circuit breaker (for testing or maintenance)
   */
  reset(): void {
    this.metrics = {
      totalErrors: 0,
      apiErrors: 0,
      timeoutErrors: 0,
      circuitBreakerTrips: 0,
      lastError: null,
      errorRate: 0,
    };
    this.errorHistory = [];
    log('[ErrorHandler] Metrics and error history reset');
  }

  /**
   * Check if system is healthy based on error metrics
   */
  isHealthy(): { healthy: boolean; reason?: string } {
    const cbState = this.circuitBreaker.getState();
    
    if (cbState.state === 'OPEN') {
      return { healthy: false, reason: 'Circuit breaker is open' };
    }
    
    if (this.metrics.errorRate > 20) { // More than 20 errors per hour
      return { healthy: false, reason: 'High error rate' };
    }
    
    return { healthy: true };
  }
}

// Export default instance
export const errorHandler = new EnhancedErrorHandler();

// Export specialized instances for different use cases
export const apiErrorHandler = new EnhancedErrorHandler(
  {
    maxRetries: 5,
    baseDelay: 2000,
    maxDelay: 60000,
  },
  {
    failureThreshold: 3,
    resetTimeout: 120000, // 2 minutes for API issues
  }
);

export const timeoutErrorHandler = new EnhancedErrorHandler(
  {
    maxRetries: 2,
    baseDelay: 5000,
    maxDelay: 30000,
  },
  {
    failureThreshold: 2,
    resetTimeout: 180000, // 3 minutes for timeouts
  }
);