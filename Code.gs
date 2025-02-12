function doPost(e) {
  // Get the spreadsheet and sheet
  const spreadsheetId = ''; // Put your spreadsheet ID here
  const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName('Times');
  
  // Parse the incoming data
  const data = JSON.parse(e.postData.contents);
  
  if (data.action === 'delete') {
    // Only allow deleting recent entries (5 minutes)
    const now = new Date();
    const timestamp = new Date(data.timestamp);
    const timeDiff = now - timestamp;
    
    // Find and delete the specific row matching sessionId, timestamp and time
    const values = sheet.getDataRange().getValues();
    for (let i = values.length - 1; i >= 0; i--) {
      if (values[i][3] === data.sessionId && // Column D has sessionId
          values[i][1] === data.time) {      // Column B has time
        sheet.deleteRow(i + 1);
        break;
      }
    }
  } else {
    // Add new row with timestamp, time, formatted time, and session info
    sheet.appendRow([
      new Date(),
      data.time,
      data.formattedTime,
      data.sessionId,
      data.sessionStart,
      data.attemptNumber
    ]);
  }
  
  return ContentService.createTextOutput('Success');
}

function doGet() {
  return ContentService.createTextOutput('The web app is running');
} 