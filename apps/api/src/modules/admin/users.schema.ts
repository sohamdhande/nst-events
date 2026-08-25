import { z } from 'zod';

export const listAdminUsersSchema = z.object({
  query: z.object({
    q: z.string().optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).default(20),
  }),
});

export const updateAdminUserRoleSchema = z.object({
  params: z.object({
    userId: z.string().uuid(),
  }),
  body: z.object({
    role: z.enum(['STUDENT', 'FACULTY_ADMIN', 'PLATFORM_ADMIN']),
  }),
});

export type ListAdminUsersQuery = z.infer<typeof listAdminUsersSchema>['query'];
export type UpdateAdminUserRoleBody = z.infer<typeof updateAdminUserRoleSchema>['body'];
export type UpdateAdminUserRoleParams = z.infer<typeof updateAdminUserRoleSchema>['params'];

export const updateAcademicBatchSchema = z.object({
  params: z.object({
    userId: z.string().uuid(),
  }),
  body: z.object({
    batchId: z.string().uuid(),
  }),
});

export type UpdateAcademicBatchBody = z.infer<typeof updateAcademicBatchSchema>['body'];
export type UpdateAcademicBatchParams = z.infer<typeof updateAcademicBatchSchema>['params'];
