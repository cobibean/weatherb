import { NextResponse } from 'next/server';
import { createGoogleSheetsClient } from '@/lib/google-sheets';

/**
 * GET /api/debug/test-sheets
 *
 * Debug endpoint to test Google Sheets integration.
 * Writes a test row to verify connectivity.
 */
export async function GET(): Promise<NextResponse> {
  const sheetsClient = createGoogleSheetsClient();

  if (!sheetsClient) {
    return NextResponse.json({
      success: false,
      error: 'Google Sheets client not available. Check GOOGLE_SHEETS_SERVICE_ACCOUNT and GOOGLE_SHEETS_SPREADSHEET_ID env vars.',
      envCheck: {
        hasServiceAccount: !!process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT,
        hasSpreadsheetId: !!process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
      },
    }, { status: 500 });
  }

  try {
    // First ensure headers exist
    await sheetsClient.initializeSheet();

    // Write a test row
    const testData = {
      marketId: 'TEST-' + Date.now(),
      city: 'Test City',
      status: 'Resolved',
      outcome: 'YES',
      timezone: 'America/Chicago',
      threshold: 850, // 85.0°F in tenths
      resolvedTemp: 867, // 86.7°F in tenths
      primaryTemp: 867,
      primaryProvider: 'test-provider',
      altTemp1: 860,
      altTemp2: 870,
      altTemp3: null,
      observedTimestamp: Math.floor(Date.now() / 1000),
      txHash: '0xTEST',
      volume: '0.00',
    };

    await sheetsClient.appendRow(testData);

    return NextResponse.json({
      success: true,
      message: 'Test row written to Google Sheets successfully!',
      data: testData,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
