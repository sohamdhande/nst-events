import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export interface RawNotificationPreferences {
  push_enabled?: boolean;
  event_reminders?: boolean;
  club_announcements?: boolean;
  attendance_alerts?: boolean;
  pushEnabled?: boolean;
  eventReminders?: boolean;
  clubAnnouncements?: boolean;
  attendanceAlerts?: boolean;
}

export interface NotificationPreferences {
  pushEnabled: boolean;
  eventReminders: boolean;
  clubAnnouncements: boolean;
  attendanceAlerts: boolean;
}

export function useNotificationPreferences() {
  return useQuery<NotificationPreferences>({
    queryKey: ['notification-preferences'],
    queryFn: async () => {
      const raw = await apiClient<RawNotificationPreferences>('/v1/notifications/preferences');
      return {
        pushEnabled: raw.push_enabled ?? raw.pushEnabled ?? true,
        eventReminders: raw.event_reminders ?? raw.eventReminders ?? true,
        clubAnnouncements: raw.club_announcements ?? raw.clubAnnouncements ?? true,
        attendanceAlerts: raw.attendance_alerts ?? raw.attendanceAlerts ?? true,
      };
    },
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<NotificationPreferences>) => {
      const body: Partial<RawNotificationPreferences> = {};
      if (data.pushEnabled !== undefined) body.push_enabled = data.pushEnabled;
      if (data.eventReminders !== undefined) body.event_reminders = data.eventReminders;
      if (data.clubAnnouncements !== undefined) body.club_announcements = data.clubAnnouncements;
      if (data.attendanceAlerts !== undefined) body.attendance_alerts = data.attendanceAlerts;

      const raw = await apiClient<RawNotificationPreferences>('/v1/notifications/preferences', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });

      return {
        pushEnabled: raw.push_enabled ?? raw.pushEnabled ?? true,
        eventReminders: raw.event_reminders ?? raw.eventReminders ?? true,
        clubAnnouncements: raw.club_announcements ?? raw.clubAnnouncements ?? true,
        attendanceAlerts: raw.attendance_alerts ?? raw.attendanceAlerts ?? true,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
    },
  });
}
