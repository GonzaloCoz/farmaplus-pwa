const fs = require('fs');
const readline = require('readline');

const logPath = 'C:\\Users\\GHCoz\\.gemini\\antigravity-ide\\brain\\b9168f72-2090-489e-a85d-03810770b3e7\\.system_generated\\logs\\transcript.jsonl';

const fileStream = fs.createReadStream(logPath);
const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  try {
    const obj = JSON.parse(line);
    const content = JSON.stringify(obj);
    if (content.includes('AppLayout.tsx')) {
      console.log(`--- Step ${obj.step_index} (${obj.type}) ---`);
      if (obj.content) {
        console.log(obj.content.substring(0, 800));
      } else if (obj.tool_calls) {
        console.log(JSON.stringify(obj.tool_calls).substring(0, 800));
      }
      console.log('\n');
    }
  } catch (e) {
    // ignore
  }
});
