import { pgListener } from './pg-listener';

class SSEConnectionManager {
  private channelReferences: Map<string, number> = new Map();

  async subscribe(eventId: string) {
    const channel = `event_${eventId}_live`;
    const count = this.channelReferences.get(channel) || 0;
    
    // Subscribe if first connection for this event
    if (count === 0) {
      await pgListener.listen(channel);
    }
    
    this.channelReferences.set(channel, count + 1);
  }

  async unsubscribe(eventId: string) {
    const channel = `event_${eventId}_live`;
    const count = this.channelReferences.get(channel) || 0;

    if (count <= 1) {
      // Unsubscribe if this was the last connection
      this.channelReferences.delete(channel);
      await pgListener.unlisten(channel);
    } else {
      this.channelReferences.set(channel, count - 1);
    }
  }
}

export const sseConnectionManager = new SSEConnectionManager();
