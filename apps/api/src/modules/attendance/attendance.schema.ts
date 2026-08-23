import { z } from 'zod';

export const generateQrSchema = z.object({
  body: z.object({
    session_id: z.string().uuid('Invalid session ID'),
  }),
});

export const markAttendanceSchema = z.object({
  body: z.object({
    session_id: z.string().uuid('Invalid session ID'),
    totp_token: z.string().min(1, 'TOTP token is required'),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    device_id: z.string().min(1, 'Device ID is required').max(255, 'Device ID is too long'),
    device_os: z.string().min(1, 'Device OS is required'),
    gps_accuracy: z.number().min(0, 'GPS accuracy must be non-negative'),
    mock_location_detected: z.boolean(),
    app_version: z.string().min(1, 'App version is required'),
  }),
});

export const syncOfflineSchema = z.object({
  body: z.object({
    records: z.array(
      z.object({
        user_id: z.string().uuid(),
        session_id: z.string().uuid(),
        scanned_token: z.string(),
        scan_timestamp: z.string().datetime(),
        device_id: z.string().max(255),
        gps_lat: z.number().min(-90).max(90),
        gps_lng: z.number().min(-180).max(180),
        gps_accuracy: z.number().min(0, 'GPS accuracy must be non-negative'),
        mock_location_detected: z.boolean(),
        offline_seq: z.number().int().min(1),
      })
    ).max(1000, 'Maximum 1000 records per batch'),
  }),
});

export const getEventAttendanceSchema = z.object({
  query: z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).default(20),
    filter_session_id: z.string().uuid().optional(),
    filter_status: z.enum(['PRESENT', 'ABSENT', 'EXCUSED']).optional(),
    filter_flagged: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  }),
});

export const getMeAttendanceSchema = z.object({
  query: z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).default(20),
  }),
});

export const manualMarkSchema = z.object({
  body: z.object({
    session_id: z.string().uuid(),
    user_id: z.string().uuid(),
  }),
});

export const submitDisputeSchema = z.object({
  body: z.object({
    session_id: z.string().uuid(),
    reason: z.string().min(10).max(1000),
    evidence_urls: z.array(z.string().url()).max(5).optional(),
  }),
});

export const getDisputesSchema = z.object({
  query: z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).default(20),
    filter_status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
    filter_event_id: z.string().uuid().optional(),
  }),
});

export const resolveDisputeSchema = z.object({
  body: z.object({
    resolution: z.enum(['APPROVED', 'REJECTED']),
    review_notes: z.string().max(1000).optional(),
  }),
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const reviewFlaggedSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});
