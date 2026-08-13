import { z } from 'zod';

export const listAuditLogsSchema = z.object({
  query: z.object({
    cursor: z.string().optional(), // BigInt cursor as string
    limit: z.coerce.number().min(1).max(100).default(50),
    entityType: z.string().optional(),
    actorId: z.string().uuid().optional(),
  }),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsSchema>['query'];
