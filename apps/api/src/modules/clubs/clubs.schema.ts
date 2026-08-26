import { z } from 'zod';
import { ClubRole, ClubStatus } from '@nst/database';

export const CreateClubSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    initial_admin_id: z.string().uuid(),
    banner_url: z.string()
      .url()
      .refine(val => val.startsWith('http://') || val.startsWith('https://'), {
        message: 'Invalid URL scheme. Only http/https allowed.',
      })
      .nullable()
      .optional(),
  }),
});

export const UpdateClubSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    banner_url: z.string()
      .url()
      .refine(val => val.startsWith('http://') || val.startsWith('https://'), {
        message: 'Invalid URL scheme. Only http/https allowed.',
      })
      .nullable()
      .optional(),
  }).strict().refine(data => Object.keys(data).length > 0, {
    message: 'At least one mutable field must be provided',
  }),
});

export const UpdateClubStatusSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.nativeEnum(ClubStatus),
  }),
});

export const AddMemberSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    user_id: z.string().uuid(),
    role: z.nativeEnum(ClubRole),
  }),
});

export const UpdateMemberRoleSchema = z.object({
  params: z.object({ id: z.string().uuid(), userId: z.string().uuid() }),
  body: z.object({
    role: z.nativeEnum(ClubRole),
  }),
});

export const ListClubsQuerySchema = z.object({
  query: z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).default(20),
    sort: z.enum(['name', 'created_at']).default('name'),
    order: z.enum(['asc', 'desc']).default('asc'),
    q: z.string().max(255).optional(),
    type: z.string().optional(),
  }),
});
