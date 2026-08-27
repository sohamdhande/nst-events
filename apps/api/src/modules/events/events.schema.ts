import { z } from 'zod';
import {
  EventState,
  EventType,
  EventVisibility,
  RegistrationType,
  AttendanceType,
  EventAudience,
} from '@nst/database';

const EventBodySchema = z.object({
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
  audience: z.nativeEnum(EventAudience).default('ALL_STUDENTS'),
  audience_batch_ids: z.array(z.string().uuid()).optional(),
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
});

const validateEventBody = (data: z.infer<typeof EventBodySchema> | Partial<z.infer<typeof EventBodySchema>>, ctx: z.RefinementCtx) => {
  if (data.audience === 'SPECIFIC_BATCHES' && (!data.audience_batch_ids || data.audience_batch_ids.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'audience_batch_ids is required when audience is SPECIFIC_BATCHES',
      path: ['audience_batch_ids']
    });
  }

  if (data.registration_type === 'TEAM') {
    const min = data.metadata?.minimum_team_size;
    const max = data.metadata?.maximum_team_size;
    
    if (typeof min !== 'number' || !Number.isInteger(min) || min < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'metadata.minimum_team_size must be an integer >= 1 for TEAM events',
        path: ['metadata', 'minimum_team_size']
      });
    }
    
    if (typeof max !== 'number' || !Number.isInteger(max) || (typeof min === 'number' && max < min)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'metadata.maximum_team_size must be an integer >= minimum_team_size',
        path: ['metadata', 'maximum_team_size']
      });
    }
  } else if (data.registration_type === 'INDIVIDUAL') {
    if (data.metadata?.minimum_team_size !== undefined || data.metadata?.maximum_team_size !== undefined) {
       ctx.addIssue({
         code: z.ZodIssueCode.custom,
         message: 'team rules must not be present in metadata for INDIVIDUAL events',
         path: ['metadata']
       });
    }
  }
};

export const CreateEventSchema = z.object({
  body: EventBodySchema.superRefine(validateEventBody),
});

export const UpdateEventSchema = z.object({
  body: EventBodySchema.omit({ club_ids: true }).partial().superRefine(validateEventBody),
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
    venue_latitude: z.number().min(-90).max(90).optional(),
    venue_longitude: z.number().min(-180).max(180).optional(),
    location_accuracy: z.number().min(0).optional(),
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

export type EventLockState = 'UNLOCKED' | 'MANUALLY_LOCKED' | 'PERMANENTLY_LOCKED';
