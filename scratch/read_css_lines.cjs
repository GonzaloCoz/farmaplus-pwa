const fs = require('fs');
const path = require('path');

const cssPath = path.resolve('src/index.css');
const content = fs.readFileSync(cssPath, 'utf8');
const lines = content.split('\n');

for (let i = 305; i < 330; i++) {
  if (lines[i]) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}
