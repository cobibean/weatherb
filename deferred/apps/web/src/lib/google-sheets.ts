import { google } from 'googleapis';

type MarketAccuracyRow = {
  marketId: string;
  city: string;
  status: string;
  outcome: string | null;
  timezone: string | null;
  threshold: number; // in tenths
  resolvedTemp: number | null; // in tenths (primary provider temp used for resolution)
  primaryTemp: number | null; // in tenths
  primaryProvider: string | null;
  altTemp1: number | null; // Reserved for future provider
  altTemp2: number | null; // Reserved for future provider
  altTemp3: number | null; // Reserved for future provider
  observedTimestamp: number | null; // Unix seconds
  txHash?: string | null;
  volume: string; // Volume in betting token (FLR)
};

export function toSheetsStatusLabel(status: 'RESOLVED' | 'NO_WINNERS' | 'CANCELLED'): string {
  switch (status) {
    case 'NO_WINNERS':
      return 'NoWinners';
    case 'CANCELLED':
      return 'Cancelled';
    case 'RESOLVED':
    default:
      return 'Resolved';
  }
}

const HEADERS = [
  'Market ID',
  'City',
  'Status',
  'Outcome',
  'Threshold',
  'Resolved Temp',
  'Primary Temp',
  'Alt Temp 1',
  'Alt Temp 2',
  'Alt Temp 3',
  'Observed Time (Local)',
  'Tx Hash',
  'Volume',
];

/**
 * Format Unix timestamp in the provided timezone.
 * Falls back to America/Chicago if timezone is missing.
 */
function formatTimestampInTimezone(timestamp: number, timezone: string | null): string {
  const date = new Date(timestamp * 1000);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone ?? 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
}

/**
 * Google Sheets client for logging market settlement data
 * Uses service account credentials for write access
 */
export class GoogleSheetsClient {
  private sheets: ReturnType<typeof google.sheets>;
  private spreadsheetId: string;
  private sheetName: string;

  constructor(credentials: string | object, spreadsheetId: string, sheetName: string = 'Sheet1') {
    this.spreadsheetId = spreadsheetId;
    this.sheetName = sheetName;
    
    // Parse credentials if string
    let credentialsObj: object;
    if (typeof credentials === 'string') {
      try {
        // Try parsing as JSON first
        credentialsObj = JSON.parse(credentials);
      } catch {
        // If that fails, try base64 decoding (useful for .env files)
        try {
          const decoded = Buffer.from(credentials, 'base64').toString('utf-8');
          credentialsObj = JSON.parse(decoded);
        } catch {
          throw new Error('Invalid credentials format. Expected JSON string or base64-encoded JSON.');
        }
      }
    } else {
      credentialsObj = credentials;
    }
    
    // Create auth client with service account credentials
    const auth = new google.auth.GoogleAuth({
      credentials: credentialsObj,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    
    this.sheets = google.sheets({
      version: 'v4',
      auth,
    });
  }

  /**
   * Initialize sheet with headers if empty
   */
  async initializeSheet(): Promise<void> {
    try {
      // Check if sheet exists and has data
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A1:Z1`,
      });

      const rows = response.data.values;
      
      // If no rows or headers don't match, add headers
      if (!rows || rows.length === 0 || rows[0]?.[0] !== HEADERS[0]) {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${this.sheetName}!A1:M1`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [HEADERS],
          },
        });
      }
    } catch (error) {
      console.error('[GoogleSheets] Failed to initialize sheet:', error);
      // Don't throw - allow append to proceed
    }
  }

  /**
   * Append a market settlement row to the sheet
   */
  async appendRow(data: MarketAccuracyRow): Promise<void> {
    try {
      // Ensure sheet is initialized
      await this.initializeSheet();

      const formatTemp = (value: number | null) => (
        value === null ? 'N/A' : (value / 10).toFixed(1)
      );
      const formatOutcome = (value: string | null) => value ?? 'N/A';

      // Format row data
      const row = [
        data.marketId,
        data.city,
        data.status,
        formatOutcome(data.outcome),
        (data.threshold / 10).toFixed(1), // Display as whole degrees
        formatTemp(data.resolvedTemp),
        formatTemp(data.primaryTemp),
        data.altTemp1 !== null ? (data.altTemp1 / 10).toFixed(1) : 'N/A',
        data.altTemp2 !== null ? (data.altTemp2 / 10).toFixed(1) : 'N/A',
        data.altTemp3 !== null ? (data.altTemp3 / 10).toFixed(1) : 'N/A',
        data.observedTimestamp ? formatTimestampInTimezone(data.observedTimestamp, data.timezone) : 'N/A',
        data.txHash ?? 'N/A',
        data.volume,
      ];

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A:M`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [row],
        },
      });

      console.log(`[GoogleSheets] Appended row for market ${data.marketId}`);
    } catch (error) {
      console.error(`[GoogleSheets] Failed to append row for market ${data.marketId}:`, error);
      // Don't throw - settlement should succeed even if Sheets write fails
    }
  }
}

/**
 * Create Google Sheets client from environment variables
 * Expects GOOGLE_SHEETS_SERVICE_ACCOUNT to be a JSON string of service account credentials
 * (API keys don't work for write operations - must use service account)
 */
export function createGoogleSheetsClient(): GoogleSheetsClient | null {
  const credentials = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT;
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  if (!credentials || !spreadsheetId) {
    console.warn('[GoogleSheets] Missing GOOGLE_SHEETS_SERVICE_ACCOUNT or GOOGLE_SHEETS_SPREADSHEET_ID, skipping Sheets logging');
    return null;
  }

  try {
    return new GoogleSheetsClient(credentials, spreadsheetId);
  } catch (error) {
    console.error('[GoogleSheets] Failed to create client:', error);
    return null;
  }
}
