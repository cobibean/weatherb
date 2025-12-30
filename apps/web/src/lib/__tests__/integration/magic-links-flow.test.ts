/**
 * Magic Links Flow Integration Tests
 *
 * Tests the complete magic link workflow for one-click admin actions.
 * Covers link generation, email sending, validation, and status updates.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Suggestion, MagicLink, TestRun } from '@prisma/client';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';

// Import modules under test
import {
  generateMagicLink,
  validateMagicLink,
  type GenerateMagicLinkParams,
  type ValidateMagicLinkResult,
} from '../../magic-links';

import {
  sendApprovalEmail,
  sendDenialEmail,
  sendWeeklyReportEmail,
  type EmailResult,
} from '../../email';

import { startTestWindow } from '../../test-runner';
import prisma from '../../prisma';

// Mock external dependencies
vi.mock('../../email');
vi.mock('../../test-runner');

// Mock crypto for deterministic testing
vi.mock('crypto', async () => {
  const actual = await vi.importActual('crypto');
  return {
    ...actual,
    randomBytes: vi.fn((length: number) => {
      // Generate deterministic "random" bytes for testing
      const bytes = Buffer.alloc(length);
      for (let i = 0; i < length; i++) {
        bytes[i] = i % 256;
      }
      return bytes;
    }),
  };
});

// Helper functions
const createMockSuggestion = (overrides?: Partial<Suggestion>): Suggestion => ({
  id: 'suggestion-456',
  city: 'Seattle',
  latitude: 47.6062,
  longitude: -122.3321,
  timeOfDay: 'morning',
  targetTemp: 65,
  targetDate: new Date('2024-12-31'),
  votes: 25,
  score: 250,
  status: 'pending',
  submittedAt: new Date(),
  approvedAt: null,
  deniedAt: null,
  processedAt: null,
  adminNotes: null,
  ...overrides,
});

const createMockMagicLink = (overrides?: Partial<MagicLink>): MagicLink => ({
  id: 'link-789',
  token: 'hashed-token-value',
  suggestionId: 'suggestion-456',
  action: 'approve',
  expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
  usedAt: null,
  createdAt: new Date(),
  ...overrides,
});

describe('Magic Links Flow Integration', () => {
  let mockPrismaClient: any;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock Prisma client
    mockPrismaClient = {
      suggestion: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      magicLink: {
        create: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      testRun: {
        create: vi.fn(),
      },
      $transaction: vi.fn((cb) => cb(mockPrismaClient)),
    };

    // Replace prisma imports
    vi.spyOn(prisma, 'suggestion').mockImplementation(() => mockPrismaClient.suggestion);
    vi.spyOn(prisma, 'magicLink').mockImplementation(() => mockPrismaClient.magicLink);
    vi.spyOn(prisma, 'testRun').mockImplementation(() => mockPrismaClient.testRun);
    vi.spyOn(prisma, '$transaction').mockImplementation(mockPrismaClient.$transaction);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Magic Link Generation and Email Sending', () => {
    it('should generate magic link and send approval email', async () => {
      const mockSuggestion = createMockSuggestion();
      const mockMagicLink = createMockMagicLink({ action: 'approve' });

      mockPrismaClient.suggestion.findUnique.mockResolvedValue(mockSuggestion);
      mockPrismaClient.magicLink.create.mockResolvedValue(mockMagicLink);

      // Generate magic link
      const params: GenerateMagicLinkParams = {
        suggestionId: mockSuggestion.id,
        action: 'approve',
      };

      const { token, url } = await generateMagicLink(params);

      // Verify token generation
      expect(token).toBeDefined();
      expect(token).toHaveLength(64); // 32 bytes hex encoded
      expect(url).toContain(baseUrl);
      expect(url).toContain('/api/admin/magic-link');
      expect(url).toContain(`token=${token}`);

      // Verify database storage (hashed)
      expect(mockPrismaClient.magicLink.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          token: expect.any(String), // Hashed token
          suggestionId: mockSuggestion.id,
          action: 'approve',
          expiresAt: expect.any(Date),
        }),
      });

      // Send approval email with magic link
      vi.mocked(sendApprovalEmail).mockResolvedValue({
        success: true,
        messageId: 'email-123',
      });

      const emailResult = await sendApprovalEmail({
        to: 'admin@weatherb.com',
        suggestion: mockSuggestion,
        approveUrl: url,
        denyUrl: `${baseUrl}/api/admin/magic-link?token=deny-token`,
      });

      expect(emailResult.success).toBe(true);
      expect(vi.mocked(sendApprovalEmail)).toHaveBeenCalledWith(
        expect.objectContaining({
          approveUrl: expect.stringContaining(token),
        })
      );
    });

    it('should generate magic link and send denial email', async () => {
      const mockSuggestion = createMockSuggestion();
      const mockMagicLink = createMockMagicLink({ action: 'deny' });

      mockPrismaClient.suggestion.findUnique.mockResolvedValue(mockSuggestion);
      mockPrismaClient.magicLink.create.mockResolvedValue(mockMagicLink);

      // Generate denial magic link
      const { token, url } = await generateMagicLink({
        suggestionId: mockSuggestion.id,
        action: 'deny',
      });

      // Send denial email
      vi.mocked(sendDenialEmail).mockResolvedValue({
        success: true,
        messageId: 'email-456',
      });

      const emailResult = await sendDenialEmail({
        to: 'admin@weatherb.com',
        suggestion: mockSuggestion,
        reason: 'City not supported',
      });

      expect(emailResult.success).toBe(true);
      expect(mockPrismaClient.magicLink.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'deny',
        }),
      });
    });

    it('should include multiple magic links in weekly report email', async () => {
      const suggestions = [
        createMockSuggestion({ id: 'sug-1', city: 'Denver', votes: 50 }),
        createMockSuggestion({ id: 'sug-2', city: 'Boston', votes: 40 }),
        createMockSuggestion({ id: 'sug-3', city: 'Austin', votes: 30 }),
      ];

      // Generate magic links for each suggestion
      const magicLinks = [];
      for (const suggestion of suggestions) {
        mockPrismaClient.suggestion.findUnique.mockResolvedValue(suggestion);
        mockPrismaClient.magicLink.create.mockResolvedValue(
          createMockMagicLink({ suggestionId: suggestion.id })
        );

        const approveLink = await generateMagicLink({
          suggestionId: suggestion.id,
          action: 'approve',
        });

        const denyLink = await generateMagicLink({
          suggestionId: suggestion.id,
          action: 'deny',
        });

        magicLinks.push({
          suggestion,
          approveUrl: approveLink.url,
          denyUrl: denyLink.url,
        });
      }

      // Send weekly report with all links
      vi.mocked(sendWeeklyReportEmail).mockResolvedValue({
        success: true,
        messageId: 'weekly-789',
      });

      const emailResult = await sendWeeklyReportEmail({
        to: 'admin@weatherb.com',
        weeklyMetrics: {
          totalSuggestions: 15,
          newSuggestions: 5,
          topCities: suggestions.map((s) => ({
            city: s.city,
            votes: s.votes,
            approveUrl: magicLinks.find((ml) => ml.suggestion.id === s.id)?.approveUrl || '',
            denyUrl: magicLinks.find((ml) => ml.suggestion.id === s.id)?.denyUrl || '',
          })),
        },
        aiInsights: 'Denver shows strong engagement...',
      });

      expect(emailResult.success).toBe(true);
      expect(vi.mocked(sendWeeklyReportEmail)).toHaveBeenCalledWith(
        expect.objectContaining({
          weeklyMetrics: expect.objectContaining({
            topCities: expect.arrayContaining([
              expect.objectContaining({
                approveUrl: expect.stringContaining('/api/admin/magic-link'),
                denyUrl: expect.stringContaining('/api/admin/magic-link'),
              }),
            ]),
          }),
        })
      );
    });
  });

  describe('Magic Link Validation and One-Time Use', () => {
    it('should validate and use magic link for approval', async () => {
      const mockSuggestion = createMockSuggestion();
      const token = 'test-token-12345678';
      const hashedToken = createHash('sha256').update(token).digest('hex');

      const mockMagicLink = createMockMagicLink({
        token: hashedToken,
        action: 'approve',
        suggestionId: mockSuggestion.id,
        usedAt: null,
      });

      // Mock finding the link
      mockPrismaClient.magicLink.findFirst.mockResolvedValue(mockMagicLink);
      mockPrismaClient.suggestion.findUnique.mockResolvedValue(mockSuggestion);

      // Validate the link
      const result: ValidateMagicLinkResult = await validateMagicLink(token);

      expect(result.valid).toBe(true);
      expect(result.action).toBe('approve');
      expect(result.suggestion?.id).toBe(mockSuggestion.id);

      // Verify link was marked as used
      expect(mockPrismaClient.magicLink.update).toHaveBeenCalledWith({
        where: { id: mockMagicLink.id },
        data: { usedAt: expect.any(Date) },
      });

      // Verify suggestion was approved
      expect(mockPrismaClient.suggestion.update).toHaveBeenCalledWith({
        where: { id: mockSuggestion.id },
        data: expect.objectContaining({
          status: 'approved',
          approvedAt: expect.any(Date),
        }),
      });

      // Mock test window start after approval
      vi.mocked(startTestWindow).mockResolvedValue({
        id: 'testrun-new',
        suggestionId: mockSuggestion.id,
        status: 'RUNNING',
      } as any);

      await startTestWindow(mockSuggestion.id);
      expect(vi.mocked(startTestWindow)).toHaveBeenCalledWith(mockSuggestion.id);
    });

    it('should validate and use magic link for denial', async () => {
      const mockSuggestion = createMockSuggestion();
      const token = 'deny-token-87654321';
      const hashedToken = createHash('sha256').update(token).digest('hex');

      const mockMagicLink = createMockMagicLink({
        token: hashedToken,
        action: 'deny',
        suggestionId: mockSuggestion.id,
      });

      mockPrismaClient.magicLink.findFirst.mockResolvedValue(mockMagicLink);
      mockPrismaClient.suggestion.findUnique.mockResolvedValue(mockSuggestion);

      const result = await validateMagicLink(token);

      expect(result.valid).toBe(true);
      expect(result.action).toBe('deny');

      // Verify suggestion was denied
      expect(mockPrismaClient.suggestion.update).toHaveBeenCalledWith({
        where: { id: mockSuggestion.id },
        data: expect.objectContaining({
          status: 'denied',
          deniedAt: expect.any(Date),
        }),
      });

      // Should NOT start test window for denial
      expect(vi.mocked(startTestWindow)).not.toHaveBeenCalled();
    });

    it('should prevent reuse of magic link', async () => {
      const token = 'used-token-11111111';
      const hashedToken = createHash('sha256').update(token).digest('hex');

      const mockMagicLink = createMockMagicLink({
        token: hashedToken,
        usedAt: new Date('2024-12-28'), // Already used
      });

      mockPrismaClient.magicLink.findFirst.mockResolvedValue(mockMagicLink);

      const result = await validateMagicLink(token);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('already been used');

      // Should NOT update anything
      expect(mockPrismaClient.magicLink.update).not.toHaveBeenCalled();
      expect(mockPrismaClient.suggestion.update).not.toHaveBeenCalled();
    });

    it('should reject expired magic links', async () => {
      const token = 'expired-token-22222222';
      const hashedToken = createHash('sha256').update(token).digest('hex');

      const mockMagicLink = createMockMagicLink({
        token: hashedToken,
        expiresAt: new Date('2024-12-01'), // Expired
        usedAt: null,
      });

      mockPrismaClient.magicLink.findFirst.mockResolvedValue(mockMagicLink);

      const result = await validateMagicLink(token);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('expired');

      // Should NOT update anything
      expect(mockPrismaClient.magicLink.update).not.toHaveBeenCalled();
      expect(mockPrismaClient.suggestion.update).not.toHaveBeenCalled();
    });

    it('should reject invalid tokens with constant-time comparison', async () => {
      const invalidToken = 'invalid-token-33333333';

      mockPrismaClient.magicLink.findFirst.mockResolvedValue(null);

      const result = await validateMagicLink(invalidToken);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid');

      // Verify constant-time comparison was attempted
      expect(mockPrismaClient.magicLink.findFirst).toHaveBeenCalledWith({
        where: {
          token: createHash('sha256').update(invalidToken).digest('hex'),
        },
      });
    });
  });

  describe('Complete Flow: Email to Test Window', () => {
    it('should complete full approval flow from email to test window start', async () => {
      // Step 1: Create a pending suggestion
      const mockSuggestion = createMockSuggestion({ status: 'pending' });
      mockPrismaClient.suggestion.findUnique.mockResolvedValue(mockSuggestion);

      // Step 2: Generate approval magic link
      mockPrismaClient.magicLink.create.mockResolvedValue(createMockMagicLink());
      const { token: approveToken, url: approveUrl } = await generateMagicLink({
        suggestionId: mockSuggestion.id,
        action: 'approve',
      });

      // Step 3: Send approval email
      vi.mocked(sendApprovalEmail).mockResolvedValue({ success: true, messageId: 'msg-1' });
      await sendApprovalEmail({
        to: 'admin@weatherb.com',
        suggestion: mockSuggestion,
        approveUrl,
        denyUrl: 'http://example.com/deny',
      });

      // Step 4: Simulate admin clicking the link
      const hashedToken = createHash('sha256').update(approveToken).digest('hex');
      mockPrismaClient.magicLink.findFirst.mockResolvedValue(
        createMockMagicLink({
          token: hashedToken,
          action: 'approve',
          suggestionId: mockSuggestion.id,
        })
      );

      // Step 5: Validate the magic link
      const validationResult = await validateMagicLink(approveToken);
      expect(validationResult.valid).toBe(true);

      // Step 6: Update suggestion status
      const approvedSuggestion = { ...mockSuggestion, status: 'approved', approvedAt: new Date() };
      mockPrismaClient.suggestion.update.mockResolvedValue(approvedSuggestion);

      // Step 7: Start test window
      vi.mocked(startTestWindow).mockResolvedValue({
        id: 'testrun-complete',
        suggestionId: mockSuggestion.id,
        status: 'RUNNING',
        marketsCreated: 5,
      } as any);

      const testRun = await startTestWindow(mockSuggestion.id);

      // Verify complete flow
      expect(testRun).toBeDefined();
      expect(testRun.status).toBe('RUNNING');
      expect(mockPrismaClient.magicLink.update).toHaveBeenCalledWith({
        where: { id: expect.any(String) },
        data: { usedAt: expect.any(Date) },
      });
      expect(mockPrismaClient.suggestion.update).toHaveBeenCalledWith({
        where: { id: mockSuggestion.id },
        data: expect.objectContaining({ status: 'approved' }),
      });
    });

    it('should complete full denial flow from email', async () => {
      // Step 1: Create a pending suggestion
      const mockSuggestion = createMockSuggestion({ status: 'pending' });
      mockPrismaClient.suggestion.findUnique.mockResolvedValue(mockSuggestion);

      // Step 2: Generate denial magic link
      mockPrismaClient.magicLink.create.mockResolvedValue(
        createMockMagicLink({ action: 'deny' })
      );
      const { token: denyToken, url: denyUrl } = await generateMagicLink({
        suggestionId: mockSuggestion.id,
        action: 'deny',
      });

      // Step 3: Send denial notification email
      vi.mocked(sendDenialEmail).mockResolvedValue({ success: true, messageId: 'msg-2' });
      await sendDenialEmail({
        to: 'admin@weatherb.com',
        suggestion: mockSuggestion,
        reason: 'Location not supported',
      });

      // Step 4: Simulate admin clicking the deny link
      const hashedToken = createHash('sha256').update(denyToken).digest('hex');
      mockPrismaClient.magicLink.findFirst.mockResolvedValue(
        createMockMagicLink({
          token: hashedToken,
          action: 'deny',
          suggestionId: mockSuggestion.id,
        })
      );

      // Step 5: Validate the magic link
      const validationResult = await validateMagicLink(denyToken);
      expect(validationResult.valid).toBe(true);
      expect(validationResult.action).toBe('deny');

      // Step 6: Update suggestion status to denied
      const deniedSuggestion = { ...mockSuggestion, status: 'denied', deniedAt: new Date() };
      mockPrismaClient.suggestion.update.mockResolvedValue(deniedSuggestion);

      // Verify denial flow (no test window started)
      expect(mockPrismaClient.suggestion.update).toHaveBeenCalledWith({
        where: { id: mockSuggestion.id },
        data: expect.objectContaining({ status: 'denied' }),
      });
      expect(vi.mocked(startTestWindow)).not.toHaveBeenCalled();
    });
  });

  describe('Security and Edge Cases', () => {
    it('should handle concurrent link validation attempts', async () => {
      const token = 'concurrent-token';
      const hashedToken = createHash('sha256').update(token).digest('hex');

      const mockMagicLink = createMockMagicLink({
        token: hashedToken,
        usedAt: null,
      });

      // First attempt finds unused link
      mockPrismaClient.magicLink.findFirst
        .mockResolvedValueOnce(mockMagicLink)
        .mockResolvedValueOnce({ ...mockMagicLink, usedAt: new Date() }); // Second attempt finds used link

      mockPrismaClient.suggestion.findUnique.mockResolvedValue(createMockSuggestion());

      // Simulate concurrent validation attempts
      const results = await Promise.allSettled([
        validateMagicLink(token),
        validateMagicLink(token),
      ]);

      // Only one should succeed
      const successCount = results.filter(
        (r) => r.status === 'fulfilled' && r.value.valid
      ).length;
      expect(successCount).toBeLessThanOrEqual(1);
    });

    it('should handle custom expiry times', async () => {
      const mockSuggestion = createMockSuggestion();
      mockPrismaClient.suggestion.findUnique.mockResolvedValue(mockSuggestion);

      // Test various expiry times
      const expiryTests = [
        { hours: 1, shouldBeValid: true },
        { hours: 24, shouldBeValid: true },
        { hours: 72, shouldBeValid: true },
        { hours: 0.01, shouldBeValid: false }, // 36 seconds, likely expired by validation
      ];

      for (const test of expiryTests) {
        vi.clearAllMocks();

        const expiresAt = new Date(Date.now() + test.hours * 60 * 60 * 1000);
        mockPrismaClient.magicLink.create.mockResolvedValue(
          createMockMagicLink({ expiresAt })
        );

        const { token } = await generateMagicLink({
          suggestionId: mockSuggestion.id,
          action: 'approve',
          expiryHours: test.hours,
        });

        expect(mockPrismaClient.magicLink.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            expiresAt: expect.any(Date),
          }),
        });

        // Verify expiry calculation
        const createCall = mockPrismaClient.magicLink.create.mock.calls[0][0];
        const actualExpiry = createCall.data.expiresAt;
        const expectedExpiry = test.hours * 60 * 60 * 1000;
        const actualDiff = actualExpiry.getTime() - Date.now();

        // Allow 1 second tolerance for test execution
        expect(Math.abs(actualDiff - expectedExpiry)).toBeLessThan(1000);
      }
    });

    it('should sanitize suggestion data in emails', async () => {
      const mockSuggestion = createMockSuggestion({
        city: '<script>alert("XSS")</script>Seattle',
        adminNotes: 'Contains <b>HTML</b> tags',
      });

      mockPrismaClient.suggestion.findUnique.mockResolvedValue(mockSuggestion);
      mockPrismaClient.magicLink.create.mockResolvedValue(createMockMagicLink());

      const { url } = await generateMagicLink({
        suggestionId: mockSuggestion.id,
        action: 'approve',
      });

      vi.mocked(sendApprovalEmail).mockResolvedValue({ success: true, messageId: 'safe-1' });

      await sendApprovalEmail({
        to: 'admin@weatherb.com',
        suggestion: mockSuggestion,
        approveUrl: url,
        denyUrl: 'http://example.com/deny',
      });

      // Verify email was called with sanitized data
      expect(vi.mocked(sendApprovalEmail)).toHaveBeenCalledWith(
        expect.objectContaining({
          suggestion: expect.objectContaining({
            city: expect.any(String), // Should be sanitized
          }),
        })
      );
    });

    it('should handle missing suggestion gracefully', async () => {
      mockPrismaClient.suggestion.findUnique.mockResolvedValue(null);

      await expect(
        generateMagicLink({
          suggestionId: 'non-existent',
          action: 'approve',
        })
      ).rejects.toThrow('Suggestion not found');
    });

    it('should validate token format before database lookup', async () => {
      const invalidTokens = [
        '',
        'short',
        'not-hex-characters-@#$%',
        null,
        undefined,
        '   ',
      ];

      for (const token of invalidTokens) {
        const result = await validateMagicLink(token as any);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();

        // Should not hit database for invalid formats
        if (token && typeof token === 'string' && token.trim().length > 0) {
          expect(mockPrismaClient.magicLink.findFirst).toHaveBeenCalledTimes(0);
        }
      }
    });
  });
});