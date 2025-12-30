import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TestResultsData } from '../../emails/test-results';
import type { WeeklySummaryData } from '../../emails/weekly-summary';

// Mock Resend
const mockSend = vi.fn();
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: mockSend,
    },
  })),
}));

// Mock @react-email/render
const mockRenderAsync = vi.fn();
vi.mock('@react-email/render', () => ({
  renderAsync: mockRenderAsync,
}));

describe('Email Service', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables
    process.env = { ...originalEnv };
    vi.clearAllMocks();

    // Reset module cache to ensure fresh imports
    vi.resetModules();

    // Default mock for renderAsync
    mockRenderAsync.mockResolvedValue('<html>Mocked Email</html>');
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('sendTestResultsEmail', () => {
    const mockTestResultsData: TestResultsData = {
      cityName: 'San Francisco',
      latitude: 37.7749,
      longitude: -122.4194,
      testRunId: 'test-run-123',
      startedAt: '2024-01-01T00:00:00Z',
      completedAt: '2024-01-01T04:00:00Z',
      status: 'COMPLETED',
      marketsCreated: 5,
      marketsSettled: 5,
      temperatureData: [
        {
          time: '2024-01-01T00:30:00Z',
          threshold: 650,
          actual: 655,
          outcome: 'YES',
        },
        {
          time: '2024-01-01T01:00:00Z',
          threshold: 660,
          actual: 658,
          outcome: 'NO',
        },
      ],
      totalVolume: '150.00',
      totalPayouts: '148.50',
      netGasCost: '0.50',
      payoutVerified: true,
      verificationDetails: 'All market payouts verified successfully',
      approveUrl: 'http://localhost:3000/admin/approve/test-123',
      denyUrl: 'http://localhost:3000/admin/deny/test-123',
      dashboardUrl: 'http://localhost:3000/admin',
    };

    it('should send test results email successfully', async () => {
      // Setup
      process.env.RESEND_API_KEY = 'test-api-key';
      process.env.ADMIN_EMAIL = 'admin@test.com';
      process.env.EMAIL_FROM = 'test@weatherb.com';

      mockSend.mockResolvedValue({
        data: { id: 'email-123' },
        error: null,
      });

      // Import email module after setting env vars
      const { sendTestResultsEmail } = await import('../email');

      // Execute
      const result = await sendTestResultsEmail(mockTestResultsData);

      // Assert
      expect(result).toEqual({
        success: true,
        data: { id: 'email-123' },
      });

      expect(mockSend).toHaveBeenCalledWith({
        from: 'test@weatherb.com',
        to: ['admin@test.com'],
        subject: 'WeatherB Test Results: San Francisco',
        html: '<html>Mocked Email</html>',
        text: undefined,
      });
    });

    it('should handle multiple admin emails', async () => {
      // Setup
      process.env.RESEND_API_KEY = 'test-api-key';
      process.env.ADMIN_EMAIL = 'admin1@test.com,admin2@test.com,admin3@test.com';

      mockSend.mockResolvedValue({
        data: { id: 'email-123' },
        error: null,
      });

      // Import email module after setting env vars
      const { sendTestResultsEmail } = await import('../email');

      // Execute
      await sendTestResultsEmail(mockTestResultsData);

      // Assert
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['admin1@test.com', 'admin2@test.com', 'admin3@test.com'],
        })
      );
    });

    it('should skip sending when no API key is configured', async () => {
      // Setup - No RESEND_API_KEY (make sure it's undefined, not just missing)
      delete process.env.RESEND_API_KEY;
      process.env.ADMIN_EMAIL = 'admin@test.com';

      // Spy on console.log
      const consoleSpy = vi.spyOn(console, 'log');

      // Import email module after setting env vars
      const { sendTestResultsEmail } = await import('../email');

      // Execute
      const result = await sendTestResultsEmail(mockTestResultsData);

      // Assert
      expect(result).toEqual({
        success: true,
        mock: true,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Email] Skipping email send (no API key):',
        expect.objectContaining({
          to: ['admin@test.com'],
          subject: 'WeatherB Test Results: San Francisco',
        })
      );

      // Verify mockSend was NOT called since there's no API key
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should handle no admin email configured', async () => {
      // Setup
      process.env.RESEND_API_KEY = 'test-api-key';
      process.env.ADMIN_EMAIL = '';

      // Spy on console.warn
      const consoleSpy = vi.spyOn(console, 'warn');

      // Import email module after setting env vars
      const { sendTestResultsEmail } = await import('../email');

      // Execute
      const result = await sendTestResultsEmail(mockTestResultsData);

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'No admin email configured',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Email] No admin email configured, skipping test results email'
      );
    });

    it('should handle Resend API errors', async () => {
      // Setup
      process.env.RESEND_API_KEY = 'test-api-key';
      process.env.ADMIN_EMAIL = 'admin@test.com';

      mockSend.mockResolvedValue({
        data: null,
        error: { message: 'API Error' },
      });

      // Spy on console.error
      const consoleSpy = vi.spyOn(console, 'error');

      // Import email module after setting env vars
      const { sendTestResultsEmail } = await import('../email');

      // Execute
      const result = await sendTestResultsEmail(mockTestResultsData);

      // Assert
      expect(result).toEqual({
        success: false,
        error: { message: 'API Error' },
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Email] Failed to send:',
        { message: 'API Error' }
      );
    });

    it('should handle failed test status', async () => {
      // Setup
      process.env.RESEND_API_KEY = 'test-api-key';
      process.env.ADMIN_EMAIL = 'admin@test.com';

      const failedData: TestResultsData = {
        ...mockTestResultsData,
        status: 'FAILED',
        errorMessage: 'Market creation failed',
      };

      mockSend.mockResolvedValue({
        data: { id: 'email-123' },
        error: null,
      });

      // Import email module after setting env vars
      const { sendTestResultsEmail } = await import('../email');

      // Execute
      const result = await sendTestResultsEmail(failedData);

      // Assert
      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalled();
    });
  });

  describe('sendWeeklySummaryEmail', () => {
    const mockWeeklySummaryData: WeeklySummaryData = {
      startDate: '2024-01-01',
      endDate: '2024-01-07',
      totalMarkets: 35,
      totalVolume: '5000.00',
      totalPayouts: '4950.00',
      uniqueBettors: 150,
      averageVolume: '142.86',
      topCities: [
        { name: 'San Francisco', markets: 7, volume: '1200.00' },
        { name: 'New York', markets: 5, volume: '900.00' },
        { name: 'Los Angeles', markets: 5, volume: '800.00' },
      ],
      approvedCities: [
        { name: 'Chicago', approvedDate: '2024-01-03' },
        { name: 'Seattle', approvedDate: '2024-01-05' },
      ],
      aiInsights: 'This week saw increased activity in coastal cities...',
      marketHighlights: [
        {
          city: 'San Francisco',
          date: '2024-01-02',
          threshold: 650,
          actual: 660,
          volume: '250.00',
          outcome: 'YES',
        },
      ],
      dashboardUrl: 'http://localhost:3000/admin',
    };

    it('should send weekly summary email successfully', async () => {
      // Setup
      process.env.RESEND_API_KEY = 'test-api-key';
      process.env.ADMIN_EMAIL = 'admin@test.com';

      mockSend.mockResolvedValue({
        data: { id: 'email-456' },
        error: null,
      });

      // Import email module after setting env vars
      const { sendWeeklySummaryEmail } = await import('../email');

      // Execute
      const result = await sendWeeklySummaryEmail(mockWeeklySummaryData);

      // Assert
      expect(result).toEqual({
        success: true,
        data: { id: 'email-456' },
      });

      expect(mockSend).toHaveBeenCalledWith({
        from: 'WeatherB <noreply@weatherb.com>',
        to: ['admin@test.com'],
        subject: 'WeatherB Weekly Insights: 2024-01-01 - 2024-01-07',
        html: '<html>Mocked Email</html>',
        text: undefined,
      });
    });

    it('should handle render errors gracefully', async () => {
      // Setup
      process.env.RESEND_API_KEY = 'test-api-key';
      process.env.ADMIN_EMAIL = 'admin@test.com';

      // Mock renderAsync to throw error
      mockRenderAsync.mockRejectedValueOnce(new Error('Render failed'));

      // Spy on console.error
      const consoleSpy = vi.spyOn(console, 'error');

      // Import email module after setting env vars
      const { sendWeeklySummaryEmail } = await import('../email');

      // Execute
      const result = await sendWeeklySummaryEmail(mockWeeklySummaryData);

      // Assert
      expect(result).toEqual({
        success: false,
        error: expect.any(Error),
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Email] Failed to send weekly summary:',
        expect.any(Error)
      );
    });
  });
});