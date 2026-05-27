const fs = require('fs');
const path = require('path');

const historyPath = 'C:\\Users\\srssa\\AppData\\Roaming\\Microsoft\\Windows\\PowerShell\\PSReadLine\\ConsoleHost_history.txt';

if (!fs.existsSync(historyPath)) {
  console.log("History file does not exist.");
  process.exit(0);
}

const content = fs.readFileSync(historyPath, 'utf8');
const lines = content.split('\n');

console.log("Searching history for 'supabase' or 'db'...");
lines.forEach((line, index) => {
  const lower = line.toLowerCase();
  if (lower.includes('supabase') || lower.includes('password') || lower.includes('rirkdpsyuvhumuhejofv') || lower.includes('postgres')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
