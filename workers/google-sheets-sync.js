/**
 * Google Apps Script for Bruchbühne Reservations
 *
 * HOW TO SET UP:
 * 1. Open your Google Sheet
 * 2. Go to Extensions → Apps Script
 * 3. Delete any existing code and paste this entire file
 * 4. Click "Deploy" → "New deployment"
 * 5. Choose "Web app"
 * 6. Execute as: "Me"
 * 7. Who has access: "Anyone" (required for Cloudflare Worker to access)
 * 8. Click "Deploy" and copy the Web App URL
 * 9. Add the URL to Cloudflare Worker secrets (see README)
 *
 * SHEET STRUCTURE:
 * The script will automatically create a sheet named "Reservations" with these columns:
 * A: Reservation ID | B: Created At | C: Name | D: Email | E: Tickets |
 * F: Show Title | G: Show Date | H: Location | I: Source | J: Source Details
 */

/**
 * Handle POST requests from Cloudflare Worker
 */
function doPost(e) {
  try {
    // Parse incoming JSON data
    const data = JSON.parse(e.postData.contents);

    // Get or create the Reservations sheet
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = spreadsheet.getSheetByName('Reservations');

    // Create sheet if it doesn't exist
    if (!sheet) {
      sheet = spreadsheet.insertSheet('Reservations');

      // Add headers
      const headers = [
        'Reservation ID',
        'Created At',
        'Name',
        'Email',
        'Tickets',
        'Show Title',
        'Show Date',
        'Location',
        'Source',
        'Source Details'
      ];

      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

      // Format header row
      sheet.getRange(1, 1, 1, headers.length)
        .setBackground('#dd4462')
        .setFontColor('#ffffff')
        .setFontWeight('bold');

      // Freeze header row
      sheet.setFrozenRows(1);

      // Auto-resize columns
      for (let i = 1; i <= headers.length; i++) {
        sheet.autoResizeColumn(i);
      }
    }

    // Format the timestamp
    const timestamp = new Date(data.createdAt);
    const formattedTimestamp = Utilities.formatDate(
      timestamp,
      'Europe/Berlin',
      'dd.MM.yyyy HH:mm:ss'
    );

    // Prepare row data
    const rowData = [
      data.id,
      formattedTimestamp,
      data.name,
      data.email,
      data.tickets,
      data.showTitle,
      data.showDateFormatted,
      data.location,
      data.source || '',
      data.sourceDetails || ''
    ];

    // Append the row
    sheet.appendRow(rowData);

    // Optional: Sort by timestamp (newest first)
    const lastRow = sheet.getLastRow();
    if (lastRow > 2) {
      sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).sort({column: 2, ascending: false});
    }

    // Return success response
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success', id: data.id }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    // Log error for debugging
    console.error('Error in doPost:', error);

    // Return error response
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'error',
        message: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle GET requests (for testing)
 */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: 'ok',
      message: 'Bruchbühne Reservations Google Sheets Sync is active',
      timestamp: new Date().toISOString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Test function - run this manually in Apps Script to test
 */
function testSync() {
  const testData = {
    postData: {
      contents: JSON.stringify({
        id: 'test-' + Date.now(),
        createdAt: new Date().toISOString(),
        name: 'Test Benutzer',
        email: 'test@example.com',
        tickets: 2,
        showTitle: 'Die Nashörner',
        showDateFormatted: 'Montag, 7. Juli 2025, 19:00 Uhr',
        location: 'Bruchbühne Tübingen',
        source: 'Test',
        sourceDetails: 'Manual test from Apps Script'
      })
    }
  };

  const result = doPost(testData);
  Logger.log(result.getContent());
}
