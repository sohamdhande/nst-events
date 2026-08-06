import { withUserContext } from '@nst/database';
import { Prisma } from '@nst/database';

export const getNotifications = async (
  userId: string,
  query: { cursor?: string; limit: number; filter_read?: boolean }
) => {
  return withUserContext(userId, async (tx) => {
    const where: Prisma.NotificationWhereInput = {
      userId,
    };

    if (query.filter_read !== undefined) {
      if (query.filter_read) {
        where.readAt = { not: null };
      } else {
        where.readAt = null;
      }
    }

    const notifications = await tx.notification.findMany({
      where,
      take: query.limit + 1,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        body: true,
        type: true,
        metadata: true,
        readAt: true,
        createdAt: true,
      },
    });

    let nextCursor: string | undefined = undefined;
    const hasMore = notifications.length > query.limit;
    if (hasMore) {
      const nextItem = notifications.pop();
      nextCursor = nextItem!.id;
    }

    return {
      data: notifications,
      pagination: {
        next_cursor: nextCursor,
        has_more: hasMore,
      },
    };
  });
};

export const markAsRead = async (userId: string, notificationId: string) => {
  return withUserContext(userId, async (tx) => {
    // We strictly ignore any client payload and only update readAt
    // We return existing readAt if it's already read (Idempotent 200 OK)
    const existing = await tx.notification.findUnique({
      where: { id: notificationId, userId },
      select: { readAt: true },
    });

    if (!existing) {
      return null; // Signals 404
    }

    if (existing.readAt) {
      return { read_at: existing.readAt };
    }

    const updated = await tx.notification.update({
      where: { id: notificationId, userId },
      data: { readAt: new Date() },
      select: { readAt: true },
    });

    return { read_at: updated.readAt };
  });
};

export const markAllAsRead = async (userId: string) => {
  return withUserContext(userId, async (tx) => {
    // Explicitly update only UNREAD notifications (where readAt IS NULL)
    await tx.notification.updateMany({
      where: {
        userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });
  });
};

export const getPreferences = async (userId: string) => {
  return withUserContext(userId, async (tx) => {
    const prefs = await tx.notificationPreference.findUnique({
      where: { userId },
    });

    if (!prefs) {
      // Lazily returned schema defaults when no row exists
      return {
        push_enabled: true,
        event_reminders: true,
        club_announcements: true,
        attendance_alerts: true,
      };
    }

    return {
      push_enabled: prefs.pushEnabled,
      event_reminders: prefs.eventReminders,
      club_announcements: prefs.clubAnnouncements,
      attendance_alerts: prefs.attendanceAlerts,
    };
  });
};

export const updatePreferences = async (
  userId: string,
  data: {
    push_enabled?: boolean;
    event_reminders?: boolean;
    club_announcements?: boolean;
    attendance_alerts?: boolean;
  }
) => {
  return withUserContext(userId, async (tx) => {
    // Performs an upsert as per the documented lifecycle
    const prefs = await tx.notificationPreference.upsert({
      where: { userId },
      update: {
        ...(data.push_enabled !== undefined && { pushEnabled: data.push_enabled }),
        ...(data.event_reminders !== undefined && { eventReminders: data.event_reminders }),
        ...(data.club_announcements !== undefined && { clubAnnouncements: data.club_announcements }),
        ...(data.attendance_alerts !== undefined && { attendanceAlerts: data.attendance_alerts }),
      },
      create: {
        userId,
        pushEnabled: data.push_enabled ?? true,
        eventReminders: data.event_reminders ?? true,
        clubAnnouncements: data.club_announcements ?? true,
        attendanceAlerts: data.attendance_alerts ?? true,
      },
    });

    return {
      push_enabled: prefs.pushEnabled,
      event_reminders: prefs.eventReminders,
      club_announcements: prefs.clubAnnouncements,
      attendance_alerts: prefs.attendanceAlerts,
    };
  });
};
