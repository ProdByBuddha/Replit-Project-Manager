import { z } from 'zod';

/**
 * Security validation schemas for git operations
 * Prevents command injection by validating all user inputs
 */

// Allowed time period patterns for git since parameter
const ALLOWED_TIME_PERIODS = [
  '1 hour ago', '2 hours ago', '6 hours ago', '12 hours ago',
  '1 day ago', '2 days ago', '3 days ago', '1 week ago', '2 weeks ago', '3 weeks ago',
  '1 month ago', '2 months ago', '3 months ago', '6 months ago', '1 year ago'
] as const;

// Date pattern validation (YYYY-MM-DD format)
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

// Safe character validation (alphanumeric, spaces, hyphens, underscores only)
const safeStringPattern = /^[a-zA-Z0-9\s\-_]+$/;

/**
 * Validates git since date parameter
 * Accepts predefined safe time periods or ISO date strings
 */
export const GitSinceDateSchema = z
  .string()
  .refine((value) => {
    // Check if it's one of the allowed time periods
    if (ALLOWED_TIME_PERIODS.includes(value as any)) {
      return true;
    }
    
    // Check if it's a valid ISO date format
    if (datePattern.test(value)) {
      const date = new Date(value);
      return !isNaN(date.getTime()) && date.getFullYear() >= 2000 && date.getFullYear() <= 2030;
    }
    
    return false;
  }, {
    message: "Invalid date format. Use predefined periods like '1 month ago' or ISO date format (YYYY-MM-DD)"
  });

/**
 * Validates confidence threshold (0-100)
 */
export const ConfidenceThresholdSchema = z
  .number()
  .int()
  .min(0, "Confidence threshold must be at least 0")
  .max(100, "Confidence threshold must be at most 100");

/**
 * Validates CLI option strings to prevent command injection
 */
export const SafeStringSchema = z
  .string()
  .max(100, "String too long")
  .refine((value) => safeStringPattern.test(value), {
    message: "Invalid characters detected. Only alphanumeric characters, spaces, hyphens, and underscores are allowed"
  });

/**
 * Git analysis configuration validation
 */
export const GitAnalysisConfigSchema = z.object({
  sinceDate: GitSinceDateSchema.optional(),
  enableSavings: z.boolean().optional().default(true),
  confidenceThreshold: ConfidenceThresholdSchema.optional().default(70),
  sendToDart: z.boolean().optional().default(true),
}).strict();

/**
 * CLI analyze command options validation
 */
export const AnalyzeOptionsSchema = z.object({
  since: GitSinceDateSchema.default('1 month ago'),
  json: z.boolean().optional().default(false),
  savings: z.boolean().optional().default(true),
  confidenceThreshold: z.string().transform((val) => parseInt(val, 10)).pipe(ConfidenceThresholdSchema).default('50'),
  savingsOnly: z.boolean().optional().default(false),
}).strict();

/**
 * CLI report command options validation
 */
export const ReportOptionsSchema = z.object({
  since: GitSinceDateSchema.default('1 month ago'),
  send: z.boolean().optional().default(true),
  preview: z.boolean().optional().default(false),
  savings: z.boolean().optional().default(true),
  confidenceThreshold: z.string().transform((val) => parseInt(val, 10)).pipe(ConfidenceThresholdSchema).default('50'),
}).strict();

/**
 * Sanitizes and validates git since date input
 */
export function sanitizeGitSinceDate(input: string): string {
  const result = GitSinceDateSchema.safeParse(input);
  if (!result.success) {
    throw new Error(`Invalid since date: ${result.error.message}`);
  }
  return result.data;
}

/**
 * Validates and sanitizes confidence threshold
 */
export function sanitizeConfidenceThreshold(input: string | number): number {
  const numValue = typeof input === 'string' ? parseInt(input, 10) : input;
  const result = ConfidenceThresholdSchema.safeParse(numValue);
  if (!result.success) {
    throw new Error(`Invalid confidence threshold: ${result.error.message}`);
  }
  return result.data;
}

/**
 * Security utility to escape any dangerous characters
 */
export function sanitizeString(input: string): string {
  // Remove any characters that could be used for command injection
  return input.replace(/[;&|`$(){}[\]\\]/g, '').trim();
}

/**
 * Type exports for TypeScript
 */
export type GitAnalysisConfig = z.infer<typeof GitAnalysisConfigSchema>;
export type AnalyzeOptions = z.infer<typeof AnalyzeOptionsSchema>;
export type ReportOptions = z.infer<typeof ReportOptionsSchema>;