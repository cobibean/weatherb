import { google } from 'googleapis';

type MarketAccuracyRow = {
  marketId: string;
  city: string;
  threshold: number; // in tenths
  resolvedTemp: number; // in tenths (primary provider temp used for resolution)
  primaryTemp: number; // in tenths
  primaryProvider: string;
  altTemp1: number | null; // NWS temp in tenths
  altTemp2: number | null; // Open-Meteo temp in tenths
  altTemp3: number | null; // Reserved for future provider
  time: string; // ISO 8601 timestamp in CST
  volume: string; // Volume in betting token (FLR)
};

const HEADERS = [
  'Market ID',
  'City',
  'Threshold',
  'Resolved Temp',
  'Primary Temp',
  'Alt Temp 1',
  'Alt Temp 2',
  'Alt Temp 3',
  'Time',
  'Volume',
];

/**
 * Convert UTC timestamp to CST (Central Standard Time) string
 * CST is UTC-6 (or UTC-5 during DST, but we'll use UTC-6 for simplicity)
 */
function toCSTString(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  // CST is UTC-6
  const cstDate = new Date(date.getTime() - 6 * 60 * 60 * 1000);
  return cstDate.toISOString().replace('T', ' ').slice(0, 19);
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
          range: `${this.sheetName}!A1:J1`,
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

      // Format row data
      const row = [
        data.marketId,
        data.city,
        (data.threshold / 10).toFixed(1), // Display as whole degrees
        (data.resolvedTemp / 10).toFixed(1), // Display as whole degrees
        (data.primaryTemp / 10).toFixed(1), // Display as whole degrees
        data.altTemp1 !== null ? (data.altTemp1 / 10).toFixed(1) : 'N/A',
        data.altTemp2 !== null ? (data.altTemp2 / 10).toFixed(1) : 'N/A',
        data.altTemp3 !== null ? (data.altTemp3 / 10).toFixed(1) : 'N/A',
        data.time,
        data.volume,
      ];

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A:J`,
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
