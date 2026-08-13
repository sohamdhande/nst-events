import { z } from 'zod';

export const ParamEventIdSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }).passthrough(),
});

export const ParamTeamIdSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }).passthrough(),
});

export const CreateTeamSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }).passthrough(),
  body: z.object({
    team_name: z.string().min(1).max(255),
  }),
});

export const ListRegistrationsQuerySchema = z.object({
  query: z.object({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().min(1).max(100).default(20),
    filter_status: z.string().optional(),
  }).passthrough(),
});

export const ListTeamsQuerySchema = z.object({
  query: z.object({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().min(1).max(100).default(20),
  }).passthrough(),
});
