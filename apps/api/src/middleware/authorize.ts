import { Request, Response, NextFunction } from 'express';
import { GlobalRole, ClubRole, withUserContext } from '@nst/database';
import { ForbiddenError } from '../lib/errors';

// Shared constants to ensure Express role checks do not drift from the RLS policies.
// The RLS policy for `club_memberships` uses exactly these bypass global roles.
export const GLOBAL_ADMIN_ROLES: GlobalRole[] = ['PLATFORM_ADMIN', 'FACULTY_ADMIN'];

/**
 * Ensures the authenticated user has one of the specified global roles.
 * Live resolution via withUserContext.
 */
export const requireRole = (roles: GlobalRole[]) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new ForbiddenError('Unauthorized access');
      }

      await withUserContext(req.user.id, async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: req.user!.id },
          select: { globalRole: true },
        });

        if (!user || !roles.includes(user.globalRole)) {
          throw new ForbiddenError('Insufficient global role');
        }
      });

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Ensures the authenticated user has one of the specified club roles for a given club_id,
 * or possesses a global bypass role.
 * Live resolution via withUserContext.
 */
export const requireClubRole = (
  getClubId: (req: Request) => string | Promise<string>,
  roles: ClubRole[]
) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new ForbiddenError('Unauthorized access');
      }

      const clubId = await getClubId(req);
      if (!clubId) {
        throw new ForbiddenError('Club ID is required for this operation');
      }

      await withUserContext(req.user.id, async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: req.user!.id },
          select: { globalRole: true },
        });

        if (!user) {
          throw new ForbiddenError('User not found');
        }

        // 1. Global Bypass Check (Matches RLS exactly)
        if (GLOBAL_ADMIN_ROLES.includes(user.globalRole)) {
          return;
        }

        // 2. Club-Scoped Role Check (Matches RLS exactly)
        const membership = await tx.clubMembership.findFirst({
          where: {
            clubId,
            userId: req.user!.id,
            deletedAt: null,
          },
          select: { role: true },
        });

        if (!membership || !roles.includes(membership.role)) {
          throw new ForbiddenError('Insufficient club role');
        }
      });

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Ensures the authenticated user has one of the specified club roles in ANY club attached to the event.
 */
export const requireEventRole = (
  getEventId: (req: Request) => string | Promise<string>,
  roles: ClubRole[]
) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) throw new ForbiddenError('Unauthorized access');
      const eventId = await getEventId(req);
      if (!eventId) throw new ForbiddenError('Event ID is required');

      await withUserContext(req.user.id, async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: req.user!.id },
          select: { globalRole: true },
        });
        if (!user) throw new ForbiddenError('User not found');
        if (GLOBAL_ADMIN_ROLES.includes(user.globalRole)) return;

        const hasRole = await tx.eventClub.findFirst({
          where: {
            eventId,
            club: {
              memberships: {
                some: {
                  userId: req.user!.id,
                  deletedAt: null,
                  role: { in: roles },
                },
              },
            },
          },
        });
        if (!hasRole) throw new ForbiddenError('Insufficient club role for this event');
      });
      next();
    } catch (error) {
      next(error);
    }
  };
};
