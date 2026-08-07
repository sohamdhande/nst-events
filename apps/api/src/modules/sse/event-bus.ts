import { EventEmitter } from 'events';

class EventBus extends EventEmitter {
  constructor() {
    super();
    // Allow unlimited clients per event channel
    this.setMaxListeners(0);
  }
}

export const sseEventBus = new EventBus();
