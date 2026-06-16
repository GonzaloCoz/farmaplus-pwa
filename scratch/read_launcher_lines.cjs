const fs = require('fs');
const path = require('path');

const filePath = path.resolve('launcher/index.js');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log("=== Lines 10 to 35 ===");
for (let i = 9; i < 35; i++) {
  if (lines[i]) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}
