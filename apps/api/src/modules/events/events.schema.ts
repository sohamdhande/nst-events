import { z } from 'zod';
import {
  EventState,
  EventType,
  EventVisibility,
  RegistrationType,
  AttendanceType,
} from '@nst/database';

export const CreateEventSchema = z.object({
  body: z.object({
    title: z.string().min(3).max(255),
    description: z.string().max(5000).optional(),
    start_time: z.string().datetime(),
    end_time: z.string().datetime(),
    location_name: z.string().max(255).optional(),
    location_lat: z.number().min(-90).max(90).optional(),
    location_lng: z.number().min(-180).max(180).optional(),
    event_type: z.nativeEnum(EventType),
    visibility: z.nativeEnum(EventVisibility).default('PUBLIC'),
    registration_type: z.nativeEnum(RegistrationType).default('INDIVIDUAL'),
    attendance_type: z.nativeEnum(AttendanceType).default('SINGLE'),
    metadata: z.record(z.unknown()).default({}),
    max_capacity: z.number().int().positive().optional(),
    club_ids: z
      .array(
        z.object({
          club_id: z.string().uuid(),
          is_primary: z.boolean(),
        })
      )
      .min(1),
  }),
});

export const UpdateEventSchema = z.object({
  body: CreateEventSchema.shape.body.omit({ club_ids: true }).partial(),
});

export const ListEventsQuerySchema = z.object({
  query: z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).default(20),
    sort: z.enum(['start_time', 'created_at']).default('start_time'),
    order: z.enum(['asc', 'desc']).default('asc'),
    filter_state: z.nativeEnum(EventState).optional(),
    filter_event_type: z.nativeEnum(EventType).optional(),
    filter_club_id: z.string().uuid().optional(),
    filter_visibility: z.nativeEnum(EventVisibility).optional(),
    q: z.string().max(255).optional(),
  }),
});

export const RejectEventSchema = z.object({
  body: z.object({
    rejection_reason: z.string().min(10).max(1000),
  }),
});

export const CreateSessionSchema = z.object({
  body: z.object({
    title: z.string().min(3).max(255),
    start_time: z.string().datetime(),
    end_time: z.string().datetime(),
    open_at: z.string().datetime(),
    close_at: z.string().datetime(),
    geofence_radius: z.number().positive().default(50),
  }),
});

export const UpdateSessionSchema = z.object({
  body: CreateSessionSchema.shape.body.partial(),
});

export type CreateEventInput = z.infer<typeof CreateEventSchema>['body'];
export type UpdateEventInput = z.infer<typeof UpdateEventSchema>['body'];
export type ListEventsQuery = z.infer<typeof ListEventsQuerySchema>['query'];
export type RejectEventInput = z.infer<typeof RejectEventSchema>['body'];
export type CreateSessionInput = z.infer<typeof CreateSessionSchema>['body'];
export type UpdateSessionInput = z.infer<typeof UpdateSessionSchema>['body'];
