import { createGoogleSheetsClient } from '../src/lib/google-sheets';

async function testHeaders() {
  const client = createGoogleSheetsClient();
  
  if (!client) {
    console.error('❌ Google Sheets client not available. Check environment variables:');
    console.error('   - GOOGLE_SHEETS_SERVICE_ACCOUNT');
    console.error('   - GOOGLE_SHEETS_SPREADSHEET_ID');
    process.exit(1);
  }

  try {
    console.log('Testing header creation...');
    await client.initializeSheet();
    console.log('✅ Headers created successfully!');
    console.log('');
    console.log('Expected headers in the spreadsheet:');
    console.log('  - Market ID');
    console.log('  - City');
    console.log('  - Threshold');
    console.log('  - Resolved Temp');
    console.log('  - Primary Temp');
    console.log('  - Alt Temp 1');
    console.log('  - Alt Temp 2');
    console.log('  - Alt Temp 3');
    console.log('  - Time');
    console.log('  - Volume');
  } catch (error) {
    console.error('❌ Failed to create headers:', error);
    process.exit(1);
  }
}

testHeaders();
