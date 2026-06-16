const fs = require('fs');
const path = require('path');
const readline = require('readline');

const logPath = 'C:\\Users\\GHCoz\\.gemini\\antigravity-ide\\brain\\b9168f72-2090-489e-a85d-03810770b3e7\\.system_generated\\logs\\transcript.jsonl';

const fileStream = fs.createReadStream(logPath);
const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity
});

const keywords = ['capa', 'recuadro', 'diseño', 'borde', 'layout', 'header'];

rl.on('line', (line) => {
  try {
    const obj = JSON.parse(line);
    if (obj.type === 'USER_INPUT' || obj.type === 'PLANNER_RESPONSE') {
      const content = obj.content || '';
      const matches = keywords.some(k => content.toLowerCase().includes(k));
      if (matches) {
        console.log(`--- Step ${obj.step_index} (${obj.type}) ---`);
        console.log(content.substring(0, 500));
        console.log('\n');
      }
    }
  } catch (e) {
    // ignore
  }
});
