import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { randomUUID } from 'crypto';

import { adminPrisma } from '../helpers/adminDb';
import { createApp } from '../../src/app';
import { signJwt } from '../../src/lib/jwt';
import { sseEventBus } from '../../src/modules/sse/event-bus';
import { sseConnectionManager } from '../../src/modules/sse/sse-connection-manager';
import { pgListener } from '../../src/modules/sse/pg-listener';

const app = createApp();

describe('Phase API-29: Notifications Realtime', () => {
  let userA: any;
  let userB: any;
  let tokenA: string;
  let tokenB: string;

  before(async () => {
    // Create users
    userA = await adminPrisma.user.create({
      data: {
        email: `usera-${Date.now()}@example.com`,
        fullName: 'User A',
        googleSub: `test-sub-a-${Date.now()}`
      },
    });
    userB = await adminPrisma.user.create({
      data: {
        email: `userb-${Date.now()}@example.com`,
        fullName: 'User B',
        googleSub: `test-sub-b-${Date.now()}`
      },
    });

    tokenA = signJwt(userA.id);
    tokenB = signJwt(userB.id);
    
    await pgListener.connect();
  });

  after(async () => {
    await adminPrisma.notificationJob.deleteMany({ where: { payload: { path: ['user_id'], equals: userA.id } } });
    await adminPrisma.notificationJob.deleteMany({ where: { payload: { path: ['user_id'], equals: userB.id } } });
    await adminPrisma.notification.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
    await adminPrisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await pgListener.disconnect();
  });

  it('accurately counts unread notifications', async () => {
    // Create unread
    await adminPrisma.notification.create({
      data: {
        userId: userA.id,
        title: 'Test',
        body: 'Unread 1',
        type: 'SYSTEM_ALERT',
        metadata: { schema_version: 1, routing: { target: 'test', fallback: '/', params: {} }, entity_ids: {} },
      }
    });

    const res = await request(app)
      .get('/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    assert.strictEqual(typeof res.body.unread_count, 'number');
    assert.ok(res.body.unread_count >= 1);
  });

  it('rejects unauthenticated SSE connection', async () => {
    await request(app)
      .get('/v1/notifications/live')
      .expect(401);
  });

  it('mark-as-read decreases unread count and triggers event', async () => {
    const notif = await adminPrisma.notification.create({
      data: {
        userId: userB.id,
        title: 'Test Read',
        body: 'Unread to Read',
        type: 'SYSTEM_ALERT',
        metadata: { schema_version: 1, routing: { target: 'test', fallback: '/', params: {} }, entity_ids: {} },
      }
    });

    let eventEmitted = false;
    const channel = `user_${userB.id}_notifications_live`;
    
    // Subscribe to pgListener so it receives the NOTIFY and forwards it to the event bus
    await sseConnectionManager.subscribeUserNotifications(userB.id);

    // We listen directly to the internal bus since testing actual SSE stream in node:test is complex,
    // but the router explicitly pipes sseEventBus to the response stream.
    const listener = (payload: any) => {
      if (payload.type === 'NOTIFICATION_READ' && payload.notification_id === notif.id) {
        eventEmitted = true;
      }
    };
    sseEventBus.on(channel, listener);

    await request(app)
      .patch(`/v1/notifications/${notif.id}/read`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    // Wait for pg_notify to propagate
    await new Promise((resolve) => setTimeout(resolve, 500));

    sseEventBus.off(channel, listener);
    
    assert.ok(eventEmitted, 'NOTIFICATION_READ event was not emitted on event bus');

    const checkRes = await request(app)
      .get('/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    
    // We expect 0 since userB only had 1 notification
    assert.strictEqual(checkRes.body.unread_count, 0);
  });
});
