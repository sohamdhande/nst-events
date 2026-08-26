import { z } from 'zod';

export const listAdminUsersSchema = z.object({
  query: z.object({
    q: z.string().optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).default(20),
    scope: z.enum(['administrators']).optional(),
  }),
});

export const updateAdminUserRoleSchema = z.object({
  params: z.object({
    userId: z.string().uuid(),
  }),
  body: z.object({
    role: z.enum(['STUDENT', 'FACULTY_MENTOR', 'FACULTY_ADMIN', 'PLATFORM_ADMIN']),
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

export const provisionUserSchema = z.object({
  body: z.object({
    email: z.string().email(),
    globalRole: z.enum(['STUDENT', 'FACULTY_MENTOR', 'FACULTY_ADMIN', 'PLATFORM_ADMIN']).optional(),
    clubId: z.string().uuid().optional(),
    clubRole: z.enum(['CLUB_ADMIN']).optional(),
  }).refine(data => {
    const domain = data.email.toLowerCase().trim().split('@')[1];
    if (domain === 'newtonschool.co') {
      return data.globalRole !== undefined && data.clubId === undefined && data.clubRole === undefined;
    } else if (domain === 'adypu.edu.in') {
      return data.clubId !== undefined && data.clubRole === 'CLUB_ADMIN' && data.globalRole === undefined;
    }
    return false; // Unsupported domain is handled in service, but we can reject here too
  }, {
    message: "Invalid provisioning payload for the given email domain. Newton users require globalRole, Adypu users require clubId and clubRole='CLUB_ADMIN'."
  }),
});

export type ProvisionUserBody = z.infer<typeof provisionUserSchema>['body'];
