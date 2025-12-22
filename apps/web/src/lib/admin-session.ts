import { cookies } from 'next/headers';
import { verifyMessage } from 'viem';
import prisma from './prisma';
import type { Prisma } from '@prisma/client';

const SESSION_COOKIE_NAME = 'admin_session';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get the list of allowed admin wallet addresses from environment.
 */
export function getAdminWallets(): string[] {
  const wallets = process.env.ADMIN_WALLETS?.split(',') || [];
  return wallets.map((w) => w.trim().toLowerCase()).filter(Boolean);
}

/**
 * Check if a wallet address is an admin.
 */
export function isAdminWallet(wallet: string): boolean {
  const adminWallets = getAdminWallets();
  return adminWallets.includes(wallet.toLowerCase());
}

/**
 * Generate a new nonce for signing.
 */
export function generateNonce(): string {
  return `weatherb-admin-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Create or update a pending session with a nonce for the wallet.
 */
export async function createPendingSession(wallet: string): Promise<{ nonce: string; sessionId: string }> {
  const normalizedWallet = wallet.toLowerCase();
  const nonce = generateNonce();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes to sign

  const session = await prisma.adminSession.create({
    data: {
      wallet: normalizedWallet,
      nonce,
      expiresAt,
    },
  });

  return { nonce, sessionId: session.id };
}

/**
 * Verify a signature and activate the session.
 */
export async function verifyAndActivateSession(
  sessionId: string,
  signature: `0x${string}`,
  expectedWallet: string
): Promise<{ success: boolean; error?: string }> {
  const normalizedWallet = expectedWallet.toLowerCase();

  // Check if wallet is an admin
  if (!isAdminWallet(normalizedWallet)) {
    return { success: false, error: 'Wallet not authorized' };
  }

  // Find the pending session
  const session = await prisma.adminSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  if (session.wallet !== normalizedWallet) {
    return { success: false, error: 'Wallet mismatch' };
  }

  if (new Date() > session.expiresAt) {
    await prisma.adminSession.delete({ where: { id: sessionId } });
    return { success: false, error: 'Session expired' };
  }

  // Verify the signature
  const message = `Sign this message to authenticate as WeatherB admin.\n\nNonce: ${session.nonce}`;
  
  try {
    const isValid = await verifyMessage({
      address: expectedWallet as `0x${string}`,
      message,
      signature,
    });

    if (!isValid) {
      return { success: false, error: 'Invalid signature' };
    }
  } catch {
    return { success: false, error: 'Signature verification failed' };
  }

  // Extend session duration
  const newExpiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await prisma.adminSession.update({
    where: { id: sessionId },
    data: { expiresAt: newExpiresAt },
  });

  // Set the session cookie
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: newExpiresAt,
    path: '/',
  });

  return { success: true };
}

/**
 * Get the current admin session from cookies.
 */
export async function getAdminSession(): Promise<{ wallet: string; sessionId: string } | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionId) {
    return null;
  }

  const session = await prisma.adminSession.findUnique({
    where: { id: sessionId },
  });

  if (!session || new Date() > session.expiresAt) {
    // Clean up expired session
    if (session) {
      await prisma.adminSession.delete({ where: { id: sessionId } }).catch(() => {});
    }
    return null;
  }

  // Verify wallet is still an admin (in case allowlist was updated)
  if (!isAdminWallet(session.wallet)) {
    await prisma.adminSession.delete({ where: { id: sessionId } }).catch(() => {});
    return null;
  }

  return { wallet: session.wallet, sessionId: session.id };
}

/**
 * Clear the admin session (logout).
 */
export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionId) {
    await prisma.adminSession.delete({ where: { id: sessionId } }).catch(() => {});
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Log an admin action.
 */
export async function logAdminAction(
  wallet: string,
  action: string,
  details?: Prisma.InputJsonValue
): Promise<void> {
  await prisma.adminLog.create({
    data: {
      wallet: wallet.toLowerCase(),
      action,
      ...(details !== undefined && { details }),
    },
  });
}

