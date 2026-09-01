import http from 'node:http';
import { EventEmitter } from 'node:events';

export type AgentStatus =
  | 'thinking'
  | 'executing'
  | 'awaiting_approval'
  | 'idle'
  | 'error'
  | 'working'
  | 'completed';

export interface AgentEventPayload {
  agent: string;
  status: AgentStatus;
  detail?: string;
  action?: string;
}

export interface AgentActivityState {
  isActive: boolean;
  agent: string;
  status: AgentStatus;
  detail?: string;
  action: string;
  updatedAt: number;
}

export class AgentGatewayService extends EventEmitter {
  private server: http.Server | null = null;
  private port = 4141;
  private currentState: AgentActivityState = {
    isActive: false,
    agent: 'Antigravity',
    status: 'idle',
    action: '',
    detail: '',
    updatedAt: 0,
  };
  private autoIdleTimer: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startServer();
  }

  public startServer(port = 4141) {
    this.port = port;
    if (this.server) {
      try {
        this.server.close();
      } catch {}
      this.server = null;
    }

    this.server = http.createServer((req, res) => {
      // 1. CORS Headers for universal client access
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost:4141'}`);

      // 2. Health & Status Check Endpoint
      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/agent-event' || url.pathname === '/status')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            gateway: 'Apex Island Universal Agent Gateway',
            port: this.port,
            status: 'online',
            current: this.currentState,
          })
        );
        return;
      }

      // 3. Main Event Receiver: POST /agent-event (<5ms instant push)
      if (req.method === 'POST' && url.pathname === '/agent-event') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
          if (body.length > 1024 * 64) {
            req.destroy();
          }
        });

        req.on('end', () => {
          try {
            const data: AgentEventPayload = JSON.parse(body);
            if (!data || !data.agent || !data.status) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Missing required fields: agent, status' }));
              return;
            }

            const state = this.handleAgentEvent(data);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, state }));
          } catch (err: any) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON payload', message: err.message }));
          }
        });
        return;
      }

      // 404 for unknown endpoints
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found', endpoint: url.pathname }));
    });

    this.server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[AgentGateway] Port ${this.port} in use. Retrying or running alongside existing instance...`);
      } else {
        console.error('[AgentGateway] Server error:', err);
      }
    });

    this.server.listen(this.port, '127.0.0.1', () => {
      console.log(`[AgentGateway] Universal Agent Gateway listening at http://127.0.0.1:${this.port}/agent-event`);
    });
  }

  public handleAgentEvent(payload: AgentEventPayload): AgentActivityState {
    const agentName = payload.agent.trim() || 'Agent';
    let status = payload.status;
    const detail = (payload.detail || payload.action || '').trim();
    const lower = `${status} ${detail}`.toLowerCase();

    // Check if agent is blocked on user permission, approval, confirmation, or input prompt
    const isWaitingForApproval =
      status === 'awaiting_approval' ||
      lower.includes('permission') ||
      lower.includes('approval') ||
      lower.includes('allow running') ||
      lower.includes('waiting for user') ||
      lower.includes('user confirmation') ||
      lower.includes('action required') ||
      lower.includes('confirm command') ||
      lower.includes('ask_question');

    if (isWaitingForApproval) {
      status = 'awaiting_approval';
    }

    const isActive =
      status === 'thinking' ||
      status === 'executing' ||
      status === 'working' ||
      status === 'awaiting_approval';

    let action = detail;
    if (!action) {
      if (status === 'thinking') action = 'Thinking...';
      else if (status === 'executing') action = 'Executing...';
      else if (status === 'awaiting_approval') action = 'Needs Approval';
      else if (status === 'completed') action = 'Task Complete';
      else if (status === 'error') action = 'Error Occurred';
      else action = 'Active';
    }

    this.currentState = {
      isActive,
      agent: agentName,
      status: status,
      detail: detail,
      action: action,
      updatedAt: Date.now(),
    };

    if (this.autoIdleTimer) {
      clearTimeout(this.autoIdleTimer);
      this.autoIdleTimer = null;
    }

    // Auto-idle after 60s if agent stopped reporting
    if (isActive) {
      this.autoIdleTimer = setTimeout(() => {
        if (this.currentState.isActive) {
          this.currentState = {
            ...this.currentState,
            isActive: false,
            status: 'idle',
            action: 'Idle',
            updatedAt: Date.now(),
          };
          this.emit('update', this.currentState);
        }
      }, 60000);
    }

    // Instant zero-copy event emit (<5ms transmission)
    this.emit('update', this.currentState);
    return this.currentState;
  }

  public onUpdate(listener: (state: AgentActivityState) => void) {
    this.on('update', listener);
    if (this.currentState.updatedAt > 0) {
      listener(this.currentState);
    }
  }

  public getCurrentState(): AgentActivityState {
    return this.currentState;
  }

  public dispose() {
    if (this.autoIdleTimer) clearTimeout(this.autoIdleTimer);
    if (this.server) {
      try {
        this.server.close();
      } catch {}
      this.server = null;
    }
  }
}

export const agentGatewayService = new AgentGatewayService();
