const fs = require('fs');
const path = require('path');

const cssPath = path.resolve('src/index.css');
let content = fs.readFileSync(cssPath, 'utf8');

// Normalize to LF for easy manipulation
const hasCRLF = content.includes('\r\n');
const normalized = content.replace(/\r\n/g, '\n');

const targetStr = `  .dark body {
    background-color: var(--background);
  }`;

const replacementStr = `  .dark body {
    background-color: var(--background);
  }

  html.is-electron body, html.is-electron .dark body {
    background-color: transparent !important;
  }`;

if (normalized.includes(targetStr)) {
  let result = normalized.replace(targetStr, replacementStr);
  if (hasCRLF) {
    result = result.replace(/\n/g, '\r\n');
  }
  fs.writeFileSync(cssPath, result, 'utf8');
  console.log("Successfully modified index.css with normalized line endings!");
} else {
  console.error("Target string not found even after normalization!");
}
