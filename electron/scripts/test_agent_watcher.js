import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function getAntigravityLive() {
  const brainDir = path.join(os.homedir(), '.gemini', 'antigravity', 'brain');
  if (!fs.existsSync(brainDir)) return null;

  const dirs = fs.readdirSync(brainDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name.length > 20)
    .map(d => {
      const full = path.join(brainDir, d.name);
      try {
        return { name: d.name, path: full, mtime: fs.statSync(full).mtimeMs };
      } catch {
        return { name: d.name, path: full, mtime: 0 };
      }
    })
    .sort((a, b) => b.mtime - a.mtime);

  if (dirs.length === 0) return null;

  const latest = dirs[0];
  const logPath = path.join(latest.path, '.system_generated', 'logs', 'transcript.jsonl');
  if (!fs.existsSync(logPath)) return null;

  const stats = fs.statSync(logPath);
  const ageSeconds = (Date.now() - stats.mtimeMs) / 1000;

  // Read last chunk of transcript
  const bufferSize = Math.min(stats.size, 16384);
  const fd = fs.openSync(logPath, 'r');
  const buffer = Buffer.alloc(bufferSize);
  fs.readSync(fd, buffer, 0, bufferSize, Math.max(0, stats.size - bufferSize));
  fs.closeSync(fd);

  const lines = buffer.toString('utf-8').trim().split('\n').filter(Boolean);
  if (lines.length === 0) return null;

  const lastJson = JSON.parse(lines[lines.length - 1]);
  let actionText = 'Working...';

  if (lastJson.tool_calls && lastJson.tool_calls.length > 0) {
    const tc = lastJson.tool_calls[0];
    const args = tc.args || {};
    let rawAction = args.toolAction || args.toolSummary || tc.toolAction || tc.name || '';
    if (typeof rawAction === 'string') {
      rawAction = rawAction.replace(/^"|"$/g, '');
    }
    if (rawAction) actionText = rawAction;
  } else if (lastJson.type === 'USER_INPUT') {
    actionText = 'Thinking...';
  }

  // Also check if any background task is running
  const tasksDir = path.join(latest.path, '.system_generated', 'tasks');
  let hasRecentTask = false;
  if (fs.existsSync(tasksDir)) {
    const taskFiles = fs.readdirSync(tasksDir);
    for (const tf of taskFiles) {
      try {
        const tStat = fs.statSync(path.join(tasksDir, tf));
        if ((Date.now() - tStat.mtimeMs) / 1000 < 30) {
          hasRecentTask = true;
          break;
        }
      } catch {}
    }
  }

  const isActive = ageSeconds < 60 || hasRecentTask;

  return {
    agent: 'Antigravity',
    isActive,
    action: actionText,
    ageSeconds: Math.round(ageSeconds),
    conversationId: latest.name,
  };
}

console.log(JSON.stringify(getAntigravityLive(), null, 2));
