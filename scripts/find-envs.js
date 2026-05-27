const fs = require('fs');
const path = require('path');

const rootDirs = [
  'd:\\Projetos IA',
  'C:\\Users\\srssa'
];

const found = [];

function scan(dir, depth = 0) {
  if (depth > 3) return; // avoid deep nested recursion
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      let stat;
      try { stat = fs.statSync(fullPath); } catch(e) { continue; }
      if (stat.isDirectory()) {
        if (file === 'node_modules' || file === '.next' || file === '.git' || file === 'AppData' || file === 'AppDataLocal' || file === 'Cookies' || file === 'SendTo' || file === 'Recent') continue;
        scan(fullPath, depth + 1);
      } else {
        const lower = file.toLowerCase();
        if (lower.includes('supabase') || lower.includes('senha') || lower.includes('pass') || lower.includes('secret')) {
          console.log("Candidate file:", fullPath);
          found.push(fullPath);
        }
      }
    }
  } catch(e) {
    // ignore
  }
}

console.log("Scanning shallow folders for credential candidates...");
rootDirs.forEach(dir => scan(dir));
console.log("Done scanning.");
