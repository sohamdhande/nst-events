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

