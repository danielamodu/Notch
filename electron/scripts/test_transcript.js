import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const brainDir = path.join(os.homedir(), '.gemini', 'antigravity', 'brain');
const dirs = fs.readdirSync(brainDir, { withFileTypes: true })
  .filter(d => d.isDirectory() && d.name.length > 20)
  .map(d => {
    const full = path.join(brainDir, d.name);
    return { name: d.name, path: full, mtime: fs.statSync(full).mtimeMs };
  })
  .sort((a, b) => b.mtime - a.mtime);

const latest = dirs[0];
const logPath = path.join(latest.path, '.system_generated', 'logs', 'transcript.jsonl');
const content = fs.readFileSync(logPath, 'utf-8').trim().split('\n');

console.log(`Total steps: ${content.length}`);
console.log('--- Last 3 Steps ---');
for (let i = Math.max(0, content.length - 3); i < content.length; i++) {
  const parsed = JSON.parse(content[i]);
  console.log(`Step ${parsed.step_index}: Type=${parsed.type}, Source=${parsed.source}, ToolCalls=${parsed.tool_calls?.length || 0}`);
  if (parsed.tool_calls) {
    for (const tc of parsed.tool_calls) {
      console.log(`  -> Tool: ${tc.name}, Action: ${tc.toolAction}, Summary: ${tc.toolSummary}`);
    }
  }
}
