import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateMagicLink,
  validateAndUseMagicLink,
  createMagicLinkUrls,
  cleanupExpiredMagicLinks,
  getMagicLinkStats
} from '../magic-links';
import prisma from '../prisma';

// Mock Prisma
vi.mock('../prisma', () => ({
  default: {
    magicLink: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    suggestion: {
      update: vi.fn(),
    },
  },
}));

// We don't mock crypto since the actual randomBytes is more secure
// Instead we'll test the behavior without checking exact token values

describe('Magic Links Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generateMagicLink', () => {
    it('should generate a magic link token', async () => {
      const mockMagicLink = {
        id: 'magic-link-1',
        tokenHash: 'hashed-token',
        suggestionId: 'suggestion-1',
        action: 'approve',
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        used: false,
      };

      (prisma.magicLink.create as any).mockResolvedValue(mockMagicLink);

      const token = await generateMagicLink({
        suggestionId: 'suggestion-1',
        action: 'approve',
      });

      // Token should be a 64-character hex string (32 bytes * 2)
      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[a-f0-9]{64}$/);
      expect(prisma.magicLink.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          suggestionId: 'suggestion-1',
          action: 'approve',
          expiresAt: expect.any(Date),
        }),
      });
    });

    it('should use custom expiry hours', async () => {
      const mockMagicLink = {
        id: 'magic-link-1',
        tokenHash: 'hashed-token',
        suggestionId: 'suggestion-1',
        action: 'deny',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        used: false,
      };

      (prisma.magicLink.create as any).mockResolvedValue(mockMagicLink);

      await generateMagicLink({
        suggestionId: 'suggestion-1',
        action: 'deny',
        expiryHours: 24,
      });

      const call = (prisma.magicLink.create as any).mock.calls[0][0];
      const expiresAt = call.data.expiresAt;
      const expectedExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Check that expiry is within 1 minute of expected (to handle timing differences)
      expect(Math.abs(expiresAt.getTime() - expectedExpiry.getTime())).toBeLessThan(60000);
    });
  });

  describe('validateAndUseMagicLink', () => {
    it('should validate and use a valid magic link', async () => {
      const mockMagicLink = {
        id: 'magic-link-1',
        tokenHash: 'hashed-token',
        suggestionId: 'suggestion-1',
        action: 'approve',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        used: false,
        suggestion: {
          id: 'suggestion-1',
          customCityName: 'San Francisco',
          status: 'PENDING',
        },
      };

      const updatedSuggestion = {
        id: 'suggestion-1',
        customCityName: 'San Francisco',
        status: 'APPROVED',
      };

      (prisma.magicLink.findUnique as any).mockResolvedValue(mockMagicLink);
      (prisma.magicLink.update as any).mockResolvedValue({ ...mockMagicLink, used: true });
      (prisma.suggestion.update as any).mockResolvedValue(updatedSuggestion);

      const result = await validateAndUseMagicLink('test-token', 'user-wallet');

      expect(result).toEqual({
        valid: true,
        suggestion: updatedSuggestion,
        action: 'approve',
      });

      expect(prisma.magicLink.update).toHaveBeenCalledWith({
        where: { id: 'magic-link-1' },
        data: {
          used: true,
          usedAt: expect.any(Date),
          usedBy: 'user-wallet',
        },
      });

      expect(prisma.suggestion.update).toHaveBeenCalledWith({
        where: { id: 'suggestion-1' },
        data: { status: 'APPROVED' },
      });
    });

    it('should reject an expired magic link', async () => {
      const mockMagicLink = {
        id: 'magic-link-1',
        tokenHash: 'hashed-token',
        suggestionId: 'suggestion-1',
        action: 'approve',
        expiresAt: new Date(Date.now() - 1000), // Expired
        used: false,
      };

      (prisma.magicLink.findUnique as any).mockResolvedValue(mockMagicLink);

      const result = await validateAndUseMagicLink('test-token');

      expect(result).toEqual({
        valid: false,
        error: 'This link has expired',
      });

      expect(prisma.magicLink.update).not.toHaveBeenCalled();
      expect(prisma.suggestion.update).not.toHaveBeenCalled();
    });

    it('should reject an already used magic link', async () => {
      const mockMagicLink = {
        id: 'magic-link-1',
        tokenHash: 'hashed-token',
        suggestionId: 'suggestion-1',
        action: 'approve',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        used: true, // Already used
        usedAt: new Date(Date.now() - 3600000),
      };

      (prisma.magicLink.findUnique as any).mockResolvedValue(mockMagicLink);

      const result = await validateAndUseMagicLink('test-token');

      expect(result).toEqual({
        valid: false,
        error: 'This link has already been used',
      });

      expect(prisma.magicLink.update).not.toHaveBeenCalled();
      expect(prisma.suggestion.update).not.toHaveBeenCalled();
    });

    it('should reject an invalid token', async () => {
      (prisma.magicLink.findUnique as any).mockResolvedValue(null);

      const result = await validateAndUseMagicLink('invalid-token');

      expect(result).toEqual({
        valid: false,
        error: 'Invalid or expired link',
      });
    });

    it('should update suggestion status to REJECTED for deny action', async () => {
      const mockMagicLink = {
        id: 'magic-link-1',
        tokenHash: 'hashed-token',
        suggestionId: 'suggestion-1',
        action: 'deny',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        used: false,
        suggestion: {
          id: 'suggestion-1',
          customCityName: 'San Francisco',
          status: 'PENDING',
        },
      };

      const updatedSuggestion = {
        id: 'suggestion-1',
        customCityName: 'San Francisco',
        status: 'REJECTED',
      };

      (prisma.magicLink.findUnique as any).mockResolvedValue(mockMagicLink);
      (prisma.magicLink.update as any).mockResolvedValue({ ...mockMagicLink, used: true });
      (prisma.suggestion.update as any).mockResolvedValue(updatedSuggestion);

      const result = await validateAndUseMagicLink('test-token');

      expect(result).toEqual({
        valid: true,
        suggestion: updatedSuggestion,
        action: 'deny',
      });

      expect(prisma.suggestion.update).toHaveBeenCalledWith({
        where: { id: 'suggestion-1' },
        data: { status: 'REJECTED' },
      });
    });

    it('should handle database errors gracefully', async () => {
      (prisma.magicLink.findUnique as any).mockRejectedValue(new Error('Database error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await validateAndUseMagicLink('test-token');

      expect(result).toEqual({
        valid: false,
        error: 'An error occurred while processing your request',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[MagicLink] Error validating token:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('createMagicLinkUrls', () => {
    it('should create magic link URLs for both actions', async () => {
      const mockApproveLink = {
        id: 'magic-link-1',
        tokenHash: 'hashed-approve-token',
      };

      const mockDenyLink = {
        id: 'magic-link-2',
        tokenHash: 'hashed-deny-token',
      };

      (prisma.magicLink.create as any)
        .mockResolvedValueOnce(mockApproveLink)
        .mockResolvedValueOnce(mockDenyLink);

      const urls = await createMagicLinkUrls('suggestion-1');

      // URLs should contain magic tokens in the correct format
      expect(urls.approveUrl).toMatch(/^http:\/\/localhost:3000\/api\/magic\/[a-f0-9]{64}$/);
      expect(urls.denyUrl).toMatch(/^http:\/\/localhost:3000\/api\/magic\/[a-f0-9]{64}$/);
      // Approve and deny URLs should be different
      expect(urls.approveUrl).not.toBe(urls.denyUrl);

      expect(prisma.magicLink.create).toHaveBeenCalledTimes(2);
    });

    it('should use custom base URL', async () => {
      (prisma.magicLink.create as any).mockResolvedValue({
        id: 'magic-link-1',
        tokenHash: 'hashed-token',
      });

      const urls = await createMagicLinkUrls('suggestion-1', 'https://example.com');

      expect(urls.approveUrl).toContain('https://example.com/api/magic/');
      expect(urls.denyUrl).toContain('https://example.com/api/magic/');
    });
  });

  describe('cleanupExpiredMagicLinks', () => {
    it('should delete expired magic links', async () => {
      (prisma.magicLink.deleteMany as any).mockResolvedValue({ count: 5 });

      const count = await cleanupExpiredMagicLinks();

      expect(count).toBe(5);
      expect(prisma.magicLink.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lt: expect.any(Date),
          },
        },
      });
    });
  });

  describe('getMagicLinkStats', () => {
    it('should return magic link statistics', async () => {
      (prisma.magicLink.count as any)
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(30) // used
        .mockResolvedValueOnce(10) // expired
        .mockResolvedValueOnce(60); // pending

      const stats = await getMagicLinkStats();

      expect(stats).toEqual({
        total: 100,
        used: 30,
        expired: 10,
        pending: 60,
      });

      expect(prisma.magicLink.count).toHaveBeenCalledTimes(4);
    });
  });
});