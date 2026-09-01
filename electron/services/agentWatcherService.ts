import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { AgentActivityState, AgentStatus } from '../../src/types/island.ts';

export class AgentWatcherService {
  private lastState: AgentActivityState = {
    isActive: false,
    agent: 'Antigravity',
    action: '',
    status: 'idle',
    updatedAt: 0,
  };
  private pollInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private listeners: Array<(state: AgentActivityState) => void> = [];
  private watchedPath: string | null = null;
  private transcriptWatcher: fs.FSWatcher | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;

  private wasWorking = false;
  private isWaitingApproval = false;
  private completedUntil = 0;

  constructor() {
    this.setupFileWatcher();
  }

  public onUpdate(listener: (state: AgentActivityState) => void) {
    this.listeners.push(listener);
    listener(this.lastState);
  }

  public startPolling(intervalMs = 300) {
    if (this.pollInterval) return;
    this.poll();
    this.heartbeatInterval = setInterval(() => this.poll(), 4000);
    this.pollInterval = setInterval(() => this.poll(), intervalMs);
  }

  public stopPolling() {
    if (this.pollInterval) { clearInterval(this.pollInterval); this.pollInterval = null; }
    if (this.heartbeatInterval) { clearInterval(this.heartbeatInterval); this.heartbeatInterval = null; }
    if (this.transcriptWatcher) { this.transcriptWatcher.close(); this.transcriptWatcher = null; }
  }

  private setupFileWatcher() {
    try {
      const active = this.findActiveConversation();
      if (!active) return;

      const logPath = active.logPath;
      if (logPath === this.watchedPath && this.transcriptWatcher) return;

      if (this.transcriptWatcher) {
        this.transcriptWatcher.close();
        this.transcriptWatcher = null;
      }

      this.watchedPath = logPath;
      this.transcriptWatcher = fs.watch(logPath, { persistent: false }, () => {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => this.poll(), 50);
      });

      this.transcriptWatcher.on('error', () => {
        this.transcriptWatcher = null;
      });
    } catch {}
  }

  private findActiveConversation(): { name: string; path: string; logPath: string; logMtime: number; logSize: number } | null {
    try {
      const brainDir = path.join(os.homedir(), '.gemini', 'antigravity', 'brain');
      if (!fs.existsSync(brainDir)) return null;

      const entries = fs.readdirSync(brainDir, { withFileTypes: true });
      const dirs = entries
        .filter((e) => e.isDirectory())
        .map((d) => {
          const full = path.join(brainDir, d.name);
          const logPath = path.join(full, '.system_generated', 'logs', 'transcript.jsonl');
          let logMtime = 0;
          let logSize = 0;
          try {
            if (fs.existsSync(logPath)) {
              const s = fs.statSync(logPath);
              logMtime = s.mtimeMs;
              logSize = s.size;
            }
          } catch {}
          return { name: d.name, path: full, logPath, logMtime, logSize };
        })
        .filter((d) => d.logMtime > 0)
        .sort((a, b) => b.logMtime - a.logMtime);

      return dirs.length > 0 ? dirs[0] : null;
    } catch {
      return null;
    }
  }

  public async poll(): Promise<AgentActivityState> {
    try {
      // 1. Check Antigravity session
      const antigravityState = this.checkAntigravity();

      // 2. Check Claude Code session
      const claudeState = this.checkClaudeCode();

      const activeAgent = antigravityState || claudeState;

      if (activeAgent && activeAgent.isActive) {
        if (activeAgent.status === 'awaiting_approval') {
          this.wasWorking = true;
          this.isWaitingApproval = true;
          this.completedUntil = 0;
          this.lastState = {
            isActive: true,
            agent: activeAgent.agent,
            action: activeAgent.action || 'Needs Approval',
            detail: activeAgent.detail || 'Action Required',
            status: 'awaiting_approval',
            updatedAt: Date.now(),
          };
        } else {
          this.wasWorking = true;
          this.isWaitingApproval = false;
          this.completedUntil = 0;
          this.lastState = {
            isActive: true,
            agent: activeAgent.agent,
            action: activeAgent.action,
            detail: activeAgent.detail,
            status: activeAgent.status || 'working',
            updatedAt: Date.now(),
          };
        }
      } else {
        // Active agent returned null (turn finished cleanly or idle)
        this.isWaitingApproval = false;

        if (this.wasWorking) {
          this.wasWorking = false;
          this.completedUntil = Date.now() + 3000;
          this.lastState = {
            isActive: false,
            agent: this.lastState.agent,
            action: 'Task Complete',
            status: 'completed',
            updatedAt: Date.now(),
          };
        } else if (Date.now() < this.completedUntil) {
          this.lastState = {
            isActive: false,
            agent: this.lastState.agent,
            action: 'Task Complete',
            status: 'completed',
            updatedAt: Date.now(),
          };
        } else {
          this.lastState = {
            isActive: false,
            agent: 'Antigravity',
            action: '',
            status: 'idle',
            updatedAt: Date.now(),
          };
        }
      }

      this.notify();
    } catch {}

    return this.lastState;
  }

  private checkAntigravity(): {
    agent: 'Antigravity';
    isActive: boolean;
    action: string;
    detail?: string;
    status: AgentStatus;
  } | null {
    try {
      const active = this.findActiveConversation();
      if (!active) return null;

      const ageSeconds = (Date.now() - active.logMtime) / 1000;

      // Check tasks directory for active background shell tasks
      const tasksDir = path.join(active.path, '.system_generated', 'tasks');
      let hasActiveTask = false;
      if (fs.existsSync(tasksDir)) {
        try {
          const taskFiles = fs.readdirSync(tasksDir);
          for (const tf of taskFiles) {
            if (!tf.endsWith('.log')) continue;
            const tStat = fs.statSync(path.join(tasksDir, tf));
            if ((Date.now() - tStat.mtimeMs) / 1000 < 15) {
              hasActiveTask = true;
              break;
            }
          }
        } catch {}
      }

      // Read latest transcript lines
      const bufferSize = Math.min(active.logSize, 32768);
      const fd = fs.openSync(active.logPath, 'r');
      const buffer = Buffer.alloc(bufferSize);
      fs.readSync(fd, buffer, 0, bufferSize, Math.max(0, active.logSize - bufferSize));
      fs.closeSync(fd);

      const rawTranscriptChunk = buffer.toString('utf-8');
      const lines = rawTranscriptChunk.trim().split('\n').filter(Boolean);
      if (lines.length === 0) return null;

      const parsedSteps: any[] = [];
      for (let i = lines.length - 1; i >= Math.max(0, lines.length - 10); i--) {
        try {
          parsedSteps.push(JSON.parse(lines[i]));
        } catch {}
      }

      if (parsedSteps.length === 0) return null;

      const newestStep = parsedSteps[0];

      // 1. If newest step is USER_INPUT, user just sent a prompt, agent is thinking
      if (newestStep?.type === 'USER_INPUT') {
        this.isWaitingApproval = false;
        return {
          agent: 'Antigravity',
          isActive: true,
          action: 'Thinking...',
          status: 'thinking',
        };
      }

      // 2. Check if explicit interactive tool (ask_question) or WAITING_FOR_INPUT
      const isExplicitApprovalTool =
        newestStep?.status === 'WAITING_FOR_INPUT' ||
        newestStep?.type === 'WAITING_FOR_INPUT' ||
        (newestStep?.tool_calls && newestStep.tool_calls.some((tc: any) => tc.name === 'ask_question' && newestStep.status !== 'DONE'));

      if (isExplicitApprovalTool) {
        this.isWaitingApproval = true;
        return {
          agent: 'Antigravity',
          isActive: true,
          action: 'Needs Approval',
          detail: 'Action Required',
          status: 'awaiting_approval',
        };
      }

      // 3. Check if newest step is a tool call that is pending user permission (e.g. run_command modal)
      if (newestStep?.type === 'PLANNER_RESPONSE' && newestStep.tool_calls && newestStep.tool_calls.length > 0) {
        const tc = newestStep.tool_calls[0];
        const args = tc.args || {};
        let actionDesc = args.toolAction || args.toolSummary || tc.toolAction || tc.name || 'Action Required';
        if (typeof actionDesc === 'string') {
          actionDesc = actionDesc.replace(/^"|"$/g, '').replace(/^\\\"|\\\"$/g, '').trim();
        }

        // If a task is actively running in background, it's executing!
        if (hasActiveTask) {
          this.isWaitingApproval = false;
          return {
            agent: 'Antigravity',
            isActive: true,
            action: actionDesc,
            status: 'executing',
          };
        }

        // If the tool has been sitting with no background task and no tool result for > 1.2s,
        // it means the IDE permission modal is open waiting for the user to click "Yes, allow this time"!
        if (ageSeconds > 1.2) {
          this.isWaitingApproval = true;
          return {
            agent: 'Antigravity',
            isActive: true,
            action: 'Needs Approval',
            detail: actionDesc,
            status: 'awaiting_approval',
          };
        }

        // First 1.2s: tool starting
        return {
          agent: 'Antigravity',
          isActive: true,
          action: actionDesc,
          status: 'working',
        };
      }

      // 4. If newest step is a completed response without tool calls and age < 45s, agent turn is DONE
      if (newestStep?.type === 'PLANNER_RESPONSE' && (!newestStep.tool_calls || newestStep.tool_calls.length === 0)) {
        if (!hasActiveTask) {
          this.isWaitingApproval = false;
          return null; // Turn finished cleanly -> transitions to completed for 3s
        }
      }

      // 5. If transcript hasn't changed in > 45s and no active background tasks, idle
      if (ageSeconds > 45 && !hasActiveTask) {
        this.isWaitingApproval = false;
        return null;
      }

      // 6. Generic working state
      let actionText = 'Working...';
      for (const step of parsedSteps) {
        if (step.tool_calls && step.tool_calls.length > 0) {
          const tc = step.tool_calls[0];
          const args = tc.args || {};
          let raw = args.toolAction || args.toolSummary || tc.toolAction || tc.name || '';
          if (typeof raw === 'string') {
            raw = raw.replace(/^"|"$/g, '').replace(/^\\\"|\\\"$/g, '').trim();
          }
          if (raw) {
            actionText = raw;
            break;
          }
        }
      }

      return {
        agent: 'Antigravity',
        isActive: true,
        action: actionText,
        status: hasActiveTask ? 'executing' : 'working',
      };
    } catch {
      return null;
    }
  }

  private checkClaudeCode(): {
    agent: 'Claude';
    isActive: boolean;
    action: string;
    status: AgentStatus;
  } | null {
    try {
      const claudeDir = path.join(os.homedir(), '.claude');
      if (!fs.existsSync(claudeDir)) return null;

      const projectsDir = path.join(claudeDir, 'projects');
      if (fs.existsSync(projectsDir)) {
        const files = fs.readdirSync(projectsDir);
        for (const file of files) {
          const full = path.join(projectsDir, file);
          const stat = fs.statSync(full);
          const age = (Date.now() - stat.mtimeMs) / 1000;
          if (age < 25) {
            return { agent: 'Claude', isActive: true, action: 'Coding...', status: 'working' };
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  private notify() {
    for (const l of this.listeners) {
      l(this.lastState);
    }
  }

  public getState(): AgentActivityState {
    return this.lastState;
  }
}

export const agentWatcherService = new AgentWatcherService();
