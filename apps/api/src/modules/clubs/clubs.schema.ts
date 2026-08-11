import { z } from 'zod';
import { ClubRole, ClubStatus } from '@nst/database';

export const CreateClubSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    initial_admin_id: z.string().uuid(),
  }),
});

export const UpdateClubStatusSchema = z.object({
  body: z.object({
    status: z.nativeEnum(ClubStatus),
  }),
});

export const AddMemberSchema = z.object({
  body: z.object({
    user_id: z.string().uuid(),
    role: z.nativeEnum(ClubRole),
  }),
});

export const UpdateMemberRoleSchema = z.object({
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
