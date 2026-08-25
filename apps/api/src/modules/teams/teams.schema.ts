import { z } from 'zod';

export const ParamTeamIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }).passthrough(),
}).passthrough();

export const CreateInvitationSchema = z.object({
  params: z.object({ id: z.string().uuid() }).passthrough(),
  body: z.object({
    invitee_id: z.string().uuid()
  })
}).passthrough();

export const ParamInvitationIdSchema = z.object({
  params: z.object({ id: z.string().uuid(), invitationId: z.string().uuid() }).passthrough(),
}).passthrough();

export const TransferLeadershipSchema = z.object({
  params: z.object({ id: z.string().uuid() }).passthrough(),
  body: z.object({
    new_leader_id: z.string().uuid()
  })
}).passthrough();

export const RemoveMemberSchema = z.object({
  params: z.object({ id: z.string().uuid(), userId: z.string().uuid() }).passthrough(),
}).passthrough();

export const CreateTeamSchema = z.object({
  params: z.object({ id: z.string().uuid() }).passthrough(),
  body: z.object({
    team_name: z.string().min(3).max(50)
  })
}).passthrough();
