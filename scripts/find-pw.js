const fs = require('fs');
const path = require('path');

const targetProject = 'rirkdpsyuvhumuhejofv';
const searchPaths = [
  'C:\\Users\\srssa\\Desktop',
  'C:\\Users\\srssa\\Downloads',
  'C:\\Users\\srssa\\OneDrive',
  'd:\\Projetos IA'
];

const extensions = ['.env', '.txt', '.json', '.md', '.yml', '.yaml', '.local', '.development', '.production'];

function searchFile(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > 1024 * 1024) return; // skip files larger than 1MB
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes(targetProject) || content.includes('supabase') || content.includes('postgres')) {
      // Look for password indicators
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        const lower = line.toLowerCase();
        if (lower.includes('password') || lower.includes('senha') || lower.includes('database_url') || lower.includes('db_pass') || lower.includes('pooler')) {
          console.log(`[MATCH] ${filePath}:${index + 1} - ${line.trim()}`);
        }
      });
    }
  } catch(e) {
    // ignore
  }
}

function scan(dir, depth = 0) {
  if (depth > 4) return;
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      let stat;
      try { stat = fs.statSync(fullPath); } catch(e) { continue; }
      if (stat.isDirectory()) {
        if (file === 'node_modules' || file === '.next' || file === '.git' || file === 'AppData' || file === 'node_modules' || file === 'dist' || file === 'build') continue;
        scan(fullPath, depth + 1);
      } else {
        const ext = path.extname(file);
        if (extensions.includes(ext) || file.startsWith('.env')) {
          searchFile(fullPath);
        }
      }
    }
  } catch(e) {
    // ignore
  }
}

console.log("Deep scanning files for database password or secrets...");
searchPaths.forEach(p => {
  console.log("Scanning path:", p);
  scan(p);
});
console.log("Deep scan complete.");
