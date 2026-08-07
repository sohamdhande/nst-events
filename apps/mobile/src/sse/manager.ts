import EventSource from 'react-native-sse';

type SSECallback = (data: any) => void;

export class SSEManager {
  private url: string;
  private token: string;
  private eventSource: EventSource | null = null;
  private reconnectAttempt: number = 0;
  private lastEventId: string | null = null;
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
  private listeners: Map<string, SSECallback[]> = new Map();

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }

  connect() {
    if (this.eventSource) return;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
    };
    
    if (this.lastEventId) {
      headers['Last-Event-ID'] = this.lastEventId;
    }

    this.eventSource = new EventSource(this.url, { headers });

    this.eventSource.addEventListener('open', () => {
      this.reconnectAttempt = 0;
      this.resetHeartbeatTimeout();
    });

    this.eventSource.addEventListener('heartbeat' as any, () => {
      this.resetHeartbeatTimeout();
    });

    this.eventSource.addEventListener('message', (e: any) => {
      if (e.lastEventId) {
        this.lastEventId = e.lastEventId;
      }
    });

    this.eventSource.addEventListener('error', (e: any) => {
      this.disconnect();
      this.scheduleReconnect();
    });
  }

  private resetHeartbeatTimeout() {
    if (this.heartbeatTimeout) clearTimeout(this.heartbeatTimeout);
    this.heartbeatTimeout = setTimeout(() => {
      this.disconnect();
      this.scheduleReconnect();
    }, 65000); // 65 seconds
  }

  private scheduleReconnect() {
    // delay = min(2000 * (2^attempt), 30000) + jitter(0–1000ms)
    const baseDelay = Math.min(2000 * Math.pow(2, this.reconnectAttempt), 30000);
    const jitter = Math.floor(Math.random() * 1000);
    const totalDelay = baseDelay + jitter;

    this.reconnectAttempt++;

    setTimeout(() => {
      this.connect();
    }, totalDelay);
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.removeAllEventListeners();
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  on(event: string, callback: SSECallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
      if (this.eventSource) {
        this.eventSource.addEventListener(event as any, (e: any) => {
          if (e.lastEventId) this.lastEventId = e.lastEventId;
          const parsed = JSON.parse(e.data || '{}');
          this.listeners.get(event)?.forEach(cb => cb(parsed));
        });
      }
    }
    this.listeners.get(event)?.push(callback);
  }
}
