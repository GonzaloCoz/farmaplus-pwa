const fs = require('fs');
const path = require('path');

const cssPath = path.resolve('src/index.css');
const content = fs.readFileSync(cssPath, 'utf8');

// Print lines that contain theme, layout, or color definitions
const lines = content.split('\n');
console.log("=== CSS VARIABLES AND THEMES ===");
lines.forEach((line, index) => {
  if (line.includes('--') || line.includes(':root') || line.includes('@theme') || line.includes('layout-')) {
    console.log(`${index + 1}: ${line}`);
  }
});
