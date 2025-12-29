import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as approveHandler } from '../approve/route';
import { POST as denyHandler } from '../deny/route';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  default: {
    suggestion: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    testRun: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    adminLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/admin-auth', () => ({
  requireAdminAuth: vi.fn(),
}));

vi.mock('@/lib/test-runner', () => ({
  startTestWindow: vi.fn(),
}));

import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';
import { startTestWindow } from '@/lib/test-runner';

describe('Admin Suggestions API Routes', () => {
  const mockAdminWallet = '0xadmin123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/admin/suggestions/approve', () => {
    it('returns 401 if not authenticated', async () => {
      vi.mocked(requireAdminAuth).mockResolvedValue({
        authenticated: false,
        error: 'Not authenticated',
      });

      const request = new NextRequest('http://localhost/api/admin/suggestions/approve', {
        method: 'POST',
        body: JSON.stringify({ suggestionId: 'test-id' }),
      });

      const response = await approveHandler(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Not authenticated');
    });

    it('returns 400 if suggestionId is missing', async () => {
      vi.mocked(requireAdminAuth).mockResolvedValue({
        authenticated: true,
        wallet: mockAdminWallet,
      });

      const request = new NextRequest('http://localhost/api/admin/suggestions/approve', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await approveHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid request');
    });

    it('returns 404 if suggestion not found', async () => {
      vi.mocked(requireAdminAuth).mockResolvedValue({
        authenticated: true,
        wallet: mockAdminWallet,
      });
      vi.mocked(prisma.suggestion.findUnique).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/admin/suggestions/approve', {
        method: 'POST',
        body: JSON.stringify({ suggestionId: 'non-existent' }),
      });

      const response = await approveHandler(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('not found');
    });

    it('returns 400 if suggestion is not PENDING', async () => {
      vi.mocked(requireAdminAuth).mockResolvedValue({
        authenticated: true,
        wallet: mockAdminWallet,
      });
      vi.mocked(prisma.suggestion.findUnique).mockResolvedValue({
        id: 'test-id',
        status: 'APPROVED',
        cityId: 'city-1',
        customCityName: null,
        latitude: null,
        longitude: null,
        timeWindow: null,
        comment: null,
        wallet: '0xuser',
        voteCount: 10,
        recentVoteCount: 5,
        lastVoteAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/admin/suggestions/approve', {
        method: 'POST',
        body: JSON.stringify({ suggestionId: 'test-id' }),
      });

      const response = await approveHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('not PENDING');
    });

    it('returns 400 if suggestion already has a running test', async () => {
      vi.mocked(requireAdminAuth).mockResolvedValue({
        authenticated: true,
        wallet: mockAdminWallet,
      });
      vi.mocked(prisma.suggestion.findUnique).mockResolvedValue({
        id: 'test-id',
        status: 'PENDING',
        cityId: 'city-1',
        customCityName: null,
        latitude: null,
        longitude: null,
        timeWindow: null,
        comment: null,
        wallet: '0xuser',
        voteCount: 10,
        recentVoteCount: 5,
        lastVoteAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(prisma.testRun.findFirst).mockResolvedValue({
        id: 'test-run-id',
        suggestionId: 'test-id',
        walletKeys: 'encrypted',
        walletCount: 3,
        keysDisposed: false,
        marketsCreated: 0,
        marketsSettled: 0,
        fundingAmount: BigInt(100),
        fundingTxHash: null,
        recoveredAmount: BigInt(0),
        netCost: BigInt(0),
        status: 'RUNNING',
        startedAt: new Date(),
        completedAt: null,
        actualTemp: null,
        totalVolume: null,
        payoutVerified: false,
        results: null,
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/admin/suggestions/approve', {
        method: 'POST',
        body: JSON.stringify({ suggestionId: 'test-id' }),
      });

      const response = await approveHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('already has a running test');
    });

    it('successfully approves suggestion and starts test window', async () => {
      vi.mocked(requireAdminAuth).mockResolvedValue({
        authenticated: true,
        wallet: mockAdminWallet,
      });
      vi.mocked(prisma.suggestion.findUnique).mockResolvedValue({
        id: 'test-id',
        status: 'PENDING',
        cityId: 'city-1',
        customCityName: null,
        latitude: null,
        longitude: null,
        timeWindow: null,
        comment: null,
        wallet: '0xuser',
        voteCount: 10,
        recentVoteCount: 5,
        lastVoteAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(prisma.testRun.findFirst).mockResolvedValue(null);
      vi.mocked(startTestWindow).mockResolvedValue({
        id: 'test-run-id',
        suggestionId: 'test-id',
        walletKeys: 'encrypted',
        walletCount: 3,
        keysDisposed: false,
        marketsCreated: 0,
        marketsSettled: 0,
        fundingAmount: BigInt(100),
        fundingTxHash: null,
        recoveredAmount: BigInt(0),
        netCost: BigInt(0),
        status: 'RUNNING',
        startedAt: new Date(),
        completedAt: null,
        actualTemp: null,
        totalVolume: null,
        payoutVerified: false,
        results: null,
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/admin/suggestions/approve', {
        method: 'POST',
        body: JSON.stringify({ suggestionId: 'test-id' }),
      });

      const response = await approveHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.testRunId).toBe('test-run-id');
      expect(startTestWindow).toHaveBeenCalledWith('test-id');
      expect(prisma.adminLog.create).toHaveBeenCalledWith({
        data: {
          wallet: mockAdminWallet,
          action: 'APPROVE_SUGGESTION',
          details: {
            suggestionId: 'test-id',
            testRunId: 'test-run-id',
          },
        },
      });
    });
  });

  describe('POST /api/admin/suggestions/deny', () => {
    it('returns 401 if not authenticated', async () => {
      vi.mocked(requireAdminAuth).mockResolvedValue({
        authenticated: false,
        error: 'Not authenticated',
      });

      const request = new NextRequest('http://localhost/api/admin/suggestions/deny', {
        method: 'POST',
        body: JSON.stringify({ suggestionId: 'test-id' }),
      });

      const response = await denyHandler(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Not authenticated');
    });

    it('returns 400 if suggestionId is missing', async () => {
      vi.mocked(requireAdminAuth).mockResolvedValue({
        authenticated: true,
        wallet: mockAdminWallet,
      });

      const request = new NextRequest('http://localhost/api/admin/suggestions/deny', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await denyHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid request');
    });

    it('returns 404 if suggestion not found', async () => {
      vi.mocked(requireAdminAuth).mockResolvedValue({
        authenticated: true,
        wallet: mockAdminWallet,
      });
      vi.mocked(prisma.suggestion.findUnique).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/admin/suggestions/deny', {
        method: 'POST',
        body: JSON.stringify({ suggestionId: 'non-existent' }),
      });

      const response = await denyHandler(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('not found');
    });

    it('successfully denies suggestion without reason', async () => {
      vi.mocked(requireAdminAuth).mockResolvedValue({
        authenticated: true,
        wallet: mockAdminWallet,
      });
      vi.mocked(prisma.suggestion.findUnique).mockResolvedValue({
        id: 'test-id',
        status: 'PENDING',
        cityId: 'city-1',
        customCityName: null,
        latitude: null,
        longitude: null,
        timeWindow: null,
        comment: null,
        wallet: '0xuser',
        voteCount: 10,
        recentVoteCount: 5,
        lastVoteAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(prisma.suggestion.update).mockResolvedValue({
        id: 'test-id',
        status: 'REJECTED',
        cityId: 'city-1',
        customCityName: null,
        latitude: null,
        longitude: null,
        timeWindow: null,
        comment: null,
        wallet: '0xuser',
        voteCount: 10,
        recentVoteCount: 5,
        lastVoteAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/admin/suggestions/deny', {
        method: 'POST',
        body: JSON.stringify({ suggestionId: 'test-id' }),
      });

      const response = await denyHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prisma.suggestion.update).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        data: { status: 'REJECTED' },
      });
      expect(prisma.adminLog.create).toHaveBeenCalledWith({
        data: {
          wallet: mockAdminWallet,
          action: 'DENY_SUGGESTION',
          details: {
            suggestionId: 'test-id',
            reason: undefined,
          },
        },
      });
    });

    it('successfully denies suggestion with reason', async () => {
      vi.mocked(requireAdminAuth).mockResolvedValue({
        authenticated: true,
        wallet: mockAdminWallet,
      });
      vi.mocked(prisma.suggestion.findUnique).mockResolvedValue({
        id: 'test-id',
        status: 'PENDING',
        cityId: 'city-1',
        customCityName: null,
        latitude: null,
        longitude: null,
        timeWindow: null,
        comment: null,
        wallet: '0xuser',
        voteCount: 10,
        recentVoteCount: 5,
        lastVoteAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(prisma.suggestion.update).mockResolvedValue({
        id: 'test-id',
        status: 'REJECTED',
        cityId: 'city-1',
        customCityName: null,
        latitude: null,
        longitude: null,
        timeWindow: null,
        comment: null,
        wallet: '0xuser',
        voteCount: 10,
        recentVoteCount: 5,
        lastVoteAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/admin/suggestions/deny', {
        method: 'POST',
        body: JSON.stringify({
          suggestionId: 'test-id',
          reason: 'Duplicate city',
        }),
      });

      const response = await denyHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prisma.adminLog.create).toHaveBeenCalledWith({
        data: {
          wallet: mockAdminWallet,
          action: 'DENY_SUGGESTION',
          details: {
            suggestionId: 'test-id',
            reason: 'Duplicate city',
          },
        },
      });
    });
  });
});
