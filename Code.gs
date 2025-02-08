function doPost(e) {
  // Get the spreadsheet and sheet
  const spreadsheetId = ''; // Put your spreadsheet ID here
  const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName('Times');
  
  // Parse the incoming data
  const data = JSON.parse(e.postData.contents);
  
  // Add row with timestamp, time, and formatted time
  sheet.appendRow([
    new Date(),
    data.time,
    data.formattedTime
  ]);
  
  return ContentService.createTextOutput('Success');
}

function doGet() {
  return ContentService.createTextOutput('The web app is running');
} 