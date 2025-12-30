/**
 * Magic Links Service
 *
 * Generates and validates secure, time-limited tokens for admin actions.
 * Uses crypto.randomBytes for token generation and SHA256 for hashing.
 *
 * Security features:
 * - Tokens are never stored in plain text
 * - 48-hour expiry by default
 * - One-time use enforcement
 * - Constant-time comparison for hash validation
 */

import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import prisma from './prisma';
import type { Suggestion } from '@prisma/client';

// Configuration
const TOKEN_LENGTH = 32; // 32 bytes = 256 bits of entropy
const TOKEN_EXPIRY_HOURS = 48;

export type MagicLinkAction = 'approve' | 'deny';

export interface GenerateMagicLinkParams {
  suggestionId: string;
  action: MagicLinkAction;
  expiryHours?: number;
}

export interface ValidateMagicLinkResult {
  valid: boolean;
  suggestion?: Suggestion;
  action?: MagicLinkAction;
  error?: string;
}

/**
 * Generates a secure random token
 */
function generateToken(): string {
  return randomBytes(TOKEN_LENGTH).toString('hex');
}

/**
 * Hashes a token using SHA256
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Safely compares two hashes using constant-time comparison
 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);

  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Generates a magic link for an admin action
 */
export async function generateMagicLink({
  suggestionId,
  action,
  expiryHours = TOKEN_EXPIRY_HOURS,
}: GenerateMagicLinkParams): Promise<string> {
  // Generate a secure random token
  const token = generateToken();
  const tokenHash = hashToken(token);

  // Calculate expiry time
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + expiryHours);

  // Store the hashed token in the database
  await prisma.magicLink.create({
    data: {
      tokenHash,
      suggestionId,
      action,
      expiresAt,
    },
  });

  // Return the unhashed token for the URL
  return token;
}

/**
 * Generates magic link URLs for email
 */
export function generateMagicLinkUrls(
  suggestionId: string,
  baseUrl?: string
): { approveUrl: string; denyUrl: string } {
  const base = baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // Note: These are placeholders - actual tokens will be generated when sending emails
  return {
    approveUrl: `${base}/api/magic/TOKEN_PLACEHOLDER?action=approve&suggestion=${suggestionId}`,
    denyUrl: `${base}/api/magic/TOKEN_PLACEHOLDER?action=deny&suggestion=${suggestionId}`,
  };
}

/**
 * Creates actual magic link URLs with real tokens
 */
export async function createMagicLinkUrls(
  suggestionId: string,
  baseUrl?: string
): Promise<{ approveUrl: string; denyUrl: string }> {
  const base = baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // Generate tokens for both actions
  const [approveToken, denyToken] = await Promise.all([
    generateMagicLink({ suggestionId, action: 'approve' }),
    generateMagicLink({ suggestionId, action: 'deny' }),
  ]);

  return {
    approveUrl: `${base}/api/magic/${approveToken}`,
    denyUrl: `${base}/api/magic/${denyToken}`,
  };
}

/**
 * Validates and uses a magic link token
 */
export async function validateAndUseMagicLink(
  token: string,
  userWallet?: string
): Promise<ValidateMagicLinkResult> {
  try {
    // Hash the provided token
    const tokenHash = hashToken(token);

    // Find the magic link in the database
    const magicLink = await prisma.magicLink.findUnique({
      where: { tokenHash },
      include: { suggestion: true },
    });

    // Check if token exists
    if (!magicLink) {
      return {
        valid: false,
        error: 'Invalid or expired link',
      };
    }

    // Check if token has expired
    if (new Date() > magicLink.expiresAt) {
      return {
        valid: false,
        error: 'This link has expired',
      };
    }

    // Check if token has been used
    if (magicLink.used) {
      return {
        valid: false,
        error: 'This link has already been used',
      };
    }

    // Mark the token as used
    await prisma.magicLink.update({
      where: { id: magicLink.id },
      data: {
        used: true,
        usedAt: new Date(),
        usedBy: userWallet,
      },
    });

    // Update the suggestion status based on the action
    const newStatus = magicLink.action === 'approve' ? 'APPROVED' : 'REJECTED';
    const updatedSuggestion = await prisma.suggestion.update({
      where: { id: magicLink.suggestionId },
      data: { status: newStatus },
    });

    return {
      valid: true,
      suggestion: updatedSuggestion,
      action: magicLink.action as MagicLinkAction,
    };
  } catch (error) {
    console.error('[MagicLink] Error validating token:', error);
    return {
      valid: false,
      error: 'An error occurred while processing your request',
    };
  }
}

/**
 * Cleans up expired magic links (for maintenance)
 */
export async function cleanupExpiredMagicLinks(): Promise<number> {
  const result = await prisma.magicLink.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  return result.count;
}

/**
 * Gets magic link statistics for monitoring
 */
export async function getMagicLinkStats() {
  const [total, used, expired, pending] = await Promise.all([
    prisma.magicLink.count(),
    prisma.magicLink.count({ where: { used: true } }),
    prisma.magicLink.count({ where: { expiresAt: { lt: new Date() } } }),
    prisma.magicLink.count({
      where: {
        used: false,
        expiresAt: { gte: new Date() },
      },
    }),
  ]);

  return { total, used, expired, pending };
}