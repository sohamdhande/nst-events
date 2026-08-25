import { pgListener } from './pg-listener';
import { buildEventChannel, buildUserNotificationChannel } from './sse.utils';

class SSEConnectionManager {
  private channelReferences: Map<string, number> = new Map();

  async subscribe(eventId: string) {
    const channel = buildEventChannel(eventId);
    const count = this.channelReferences.get(channel) || 0;
    
    // Subscribe if first connection for this event
    if (count === 0) {
      await pgListener.listen(channel);
    }
    
    this.channelReferences.set(channel, count + 1);
  }

  async unsubscribe(eventId: string) {
    const channel = buildEventChannel(eventId);
    const count = this.channelReferences.get(channel) || 0;

    if (count <= 1) {
      // Unsubscribe if this was the last connection
      this.channelReferences.delete(channel);
      await pgListener.unlisten(channel);
    } else {
      this.channelReferences.set(channel, count - 1);
    }
  }

  async subscribeUserNotifications(userId: string) {
    const channel = buildUserNotificationChannel(userId);
    const count = this.channelReferences.get(channel) || 0;
    
    // Subscribe if first connection for this user
    if (count === 0) {
      await pgListener.listen(channel);
    }
    
    this.channelReferences.set(channel, count + 1);
  }

  async unsubscribeUserNotifications(userId: string) {
    const channel = buildUserNotificationChannel(userId);
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
