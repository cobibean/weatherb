# Google Sheets Market Accuracy Tracking

## Overview

Market settlement data is automatically logged to Google Sheets for accuracy tracking and analysis. Each settled market includes:

- Market details (ID, city, threshold)
- Primary provider temperature (used for resolution)
- Alternative provider temperatures (NWS, Open-Meteo, MET Norway)
- Outcome and volume data

## Environment Variables

Add these to your `.env` file:

```bash
# Google Sheets Integration
# Note: Must use service account credentials (not API key) for write access

# Option 1: Single-line JSON (recommended for .env files)
GOOGLE_SHEETS_SERVICE_ACCOUNT='{"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}'
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id_here

# Option 2: Base64-encoded JSON (better for multi-line values)
# Encode your JSON: cat service-account.json | base64
# GOOGLE_SHEETS_SERVICE_ACCOUNT=<base64_encoded_json_here>
```

### Getting Service Account Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google Sheets API
4. Create a Service Account:
   - Go to "IAM & Admin" → "Service Accounts"
   - Click "Create Service Account"
   - Give it a name (e.g., "weatherb-sheets")
   - Grant it "Editor" role (or create custom role with Sheets API access)
5. Create a key:
   - Click on the service account
   - Go to "Keys" tab
   - Click "Add Key" → "Create new key"
   - Choose JSON format
   - Download the JSON file
6. Share your Google Sheet with the service account email (found in the JSON file)
7. Copy the entire JSON content and paste it as `GOOGLE_SHEETS_SERVICE_ACCOUNT` (as a single-line JSON string)

### Getting Spreadsheet ID

1. Open your Google Sheet
2. The URL will look like: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
3. Copy the `SPREADSHEET_ID` part

## Sheet Structure

The sheet will automatically create headers on first write:

| Column | Description |
|--------|-------------|
| Market ID | Contract market ID |
| City | City name |
| Threshold | Threshold temperature (°F) |
| Resolved Temp | Temperature used for resolution (°F) |
| Primary Temp | Primary provider temperature (°F) |
| Alt Temp 1 | NWS temperature (°F) or N/A |
| Alt Temp 2 | Open-Meteo temperature (°F) or N/A |
| Alt Temp 3 | MET Norway temperature (°F) or N/A |
| Time | Settlement time (CST) |
| Volume | Total betting volume (FLR) |

## How It Works

1. When a market is settled via the cron job (`/api/cron/settle-markets`)
2. The system fetches temperature from the primary provider (MET Norway by default)
3. It also fetches temperatures from all alternative providers (NWS, Open-Meteo)
4. Market volume is calculated from the contract (yesPool + noPool)
5. All data is written to Google Sheets (non-blocking - settlement succeeds even if Sheets write fails)

## Error Handling

- If Google Sheets credentials are missing, settlement still succeeds (warning logged)
- If Sheets API fails, settlement still succeeds (error logged)
- Sheet headers are auto-created on first write
- Each market gets a new row appended

## Notes

- Temperatures are stored internally in tenths (853 = 85.3°F) but displayed as whole degrees in the sheet
- Time is converted to CST (UTC-6) for readability
- Volume is in FLR (converted from wei, 18 decimals)
