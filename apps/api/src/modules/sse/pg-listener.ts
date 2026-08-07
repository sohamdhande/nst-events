import { Client, Notification } from 'pg';
import { env } from '../../config/env';
import { sseEventBus } from './event-bus';

class PGListener {
  private client: Client | null = null;
  private isConnecting: boolean = false;
  private activeChannels: Set<string> = new Set();
  private reconnectTimeout: NodeJS.Timeout | null = null;

  async connect() {
    if (this.client || this.isConnecting) return;
    this.isConnecting = true;

    try {
      this.client = new Client({
        connectionString: env.DATABASE_URL,
      });

      this.client.on('notification', (msg: Notification) => {
        if (!msg.channel || !msg.payload) return;
        try {
          const parsed = JSON.parse(msg.payload);
          sseEventBus.emit(msg.channel, parsed);
        } catch (e) {
          console.error('PGListener JSON parse error:', e);
        }
      });

      this.client.on('error', (err: Error) => {
        console.error('PGListener Client Error:', err);
        this.handleDisconnect();
      });

      this.client.on('end', () => {
        console.error('PGListener Connection Ended');
        this.handleDisconnect();
      });

      await this.client.connect();
      
      // Restore active subscriptions on reconnect
      for (const channel of this.activeChannels) {
        await this.client.query(`LISTEN ${channel}`);
      }

      this.isConnecting = false;
    } catch (error) {
      console.error('PGListener Connection Error:', error);
      this.isConnecting = false;
      this.handleDisconnect();
    }
  }

  private handleDisconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.client = null;
    this.reconnectTimeout = setTimeout(() => this.connect(), 5000);
  }

  async listen(channel: string) {
    this.activeChannels.add(channel);
    if (this.client) {
      try {
        await this.client.query(`LISTEN ${channel}`);
      } catch (e) {
        console.error(`PGListener listen error on ${channel}:`, e);
      }
    }
  }

  async unlisten(channel: string) {
    this.activeChannels.delete(channel);
    if (this.client) {
      try {
        await this.client.query(`UNLISTEN ${channel}`);
      } catch (e) {
        console.error(`PGListener unlisten error on ${channel}:`, e);
      }
    }
  }

  async disconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.client) {
      await this.client.end();
      this.client = null;
    }
  }
}

export const pgListener = new PGListener();
