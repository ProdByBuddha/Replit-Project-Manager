import { z } from 'zod';

/**
 * Git input validation and sanitization for security
 */

// Valid git since date patterns (prevent injection)
const VALID_SINCE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
  /^\d+ (second|minute|hour|day|week|month|year)s? ago$/, // N units ago
  /^yesterday$/, 
  /^last (week|month|year)$/,
  /^\d+ (second|minute|hour|day|week|month|year)s?$/, // N units
];

/**
 * Sanitize git since date parameter to prevent command injection
 */
export function sanitizeGitSinceDate(sinceDate: string): string {
  if (!sinceDate || typeof sinceDate !== 'string') {
    return '1 month ago';
  }

  const cleaned = sinceDate.trim().toLowerCase();
  
  // Check against allowed patterns
  const isValid = VALID_SINCE_PATTERNS.some(pattern => pattern.test(cleaned));
  
  if (!isValid) {
    console.warn(`[Security] Invalid since date format: ${sinceDate}, using default`);
    return '1 month ago';
  }
  
  return cleaned;
}

/**
 * Sanitize confidence threshold (0-100)
 */
export function sanitizeConfidenceThreshold(threshold: number | string): number {
  const num = typeof threshold === 'string' ? parseInt(threshold, 10) : threshold;
  
  if (isNaN(num) || num < 0 || num > 100) {
    return 70; // Default threshold
  }
  
  return Math.round(num);
}

/**
 * Zod schemas for CLI argument validation
 */
export const AnalyzeOptionsSchema = z.object({
  since: z.string()
    .transform(sanitizeGitSinceDate)
    .default('1 month ago'),
  json: z.boolean().default(false),
  confidenceThreshold: z.string()
    .regex(/^\d+$/, 'Must be a number')
    .transform(val => parseInt(val, 10))
    .pipe(z.number().min(0).max(100))
    .default('70'),
});

export const ReportOptionsSchema = z.object({
  since: z.string()
    .transform(sanitizeGitSinceDate)  
    .default('1 month ago'),
  send: z.boolean().default(true),
  preview: z.boolean().default(false),
  confidenceThreshold: z.string()
    .regex(/^\d+$/, 'Must be a number')
    .transform(val => parseInt(val, 10))
    .pipe(z.number().min(0).max(100))
    .default('70'),
});

export const GitAnalysisConfigSchema = z.object({
  sinceDate: z.string().optional(),
  enableSavings: z.boolean().default(true),
  confidenceThreshold: z.number().min(0).max(100).default(70),
  projectParameters: z.record(z.any()).optional(),
  sendToDart: z.boolean().default(false),
});

export type AnalyzeOptions = z.infer<typeof AnalyzeOptionsSchema>;
export type ReportOptions = z.infer<typeof ReportOptionsSchema>;
export type GitAnalysisConfig = z.infer<typeof GitAnalysisConfigSchema>;