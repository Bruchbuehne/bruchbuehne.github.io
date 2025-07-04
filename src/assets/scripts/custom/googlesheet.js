// Adapted from https://github.com/Sternenwanderer/sternenwanderer.github.io.git (original author: @LukasProgress)
function doPost(e) {
    const params = e.parameter;
    const name = params.name;
    const email = params.email;
    const anzahl = params.anzahl;
    const datum = params.datum;
    const herkunft = params.herkunft;
    const herkunftDetails = params.herkunft_details;
    const herkunftFinal = herkunft === "Anderes" && herkunftDetails ? `Anderes: ${herkunftDetails}` : herkunft;
  
  
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName(datum);
  
    if (!sheet) {
      return ContentService.createTextOutput("FEHLER: Kein Tab für dieses Datum.");
    }
  
    const timestamp = new Date();
    sheet.appendRow([name, anzahl, email, timestamp, herkunftFinal]);
  
    const subject = `Deine Reservierung für Die Nashörner am ${datum}`;
    const body = `
  Hallo ${name},
  
  vielen Dank für deine Reservierung für Die Nashörner am ${datum}.
  Wir haben ${anzahl} Karte(n) für dich hinterlegt.
  
  Bitte beachte: Die Karten liegen an der Abendkasse zur Abholung bereit.
  Bei Verspätung oder Nichterscheinen behalten wir uns vor, die Reservierung freizugeben.
  
  Wir freuen uns auf deinen/euren Besuch!
  
  Eure Bruchbühne
  `;
  
    MailApp.sendEmail(email, subject, body);
  
    return ContentService.createTextOutput("OK");
  }
  
  function doGet(e) {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = spreadsheet.getSheets();
    
    let result = [];
  
    sheets.forEach(sheet => {
      const name = sheet.getName();
      const count = sheet.getRange("H2").getValue();  // Anzahl Reservierungen
      const max = sheet.getRange("H1").getValue(); // Maximum
      const remaining = max - count;
  
      result.push({
        date: name,
        remaining: remaining
      });
    });
  
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }
  