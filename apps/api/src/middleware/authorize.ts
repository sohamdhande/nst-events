import { Request, Response, NextFunction } from 'express';
import { GlobalRole, ClubRole, withUserContext } from '@nst/database';
import { ForbiddenError } from '../lib/errors';

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
 * Ensures the authenticated user can manage club details.
 * Allows PLATFORM_ADMIN, FACULTY_ADMIN globally, and CLUB_ADMIN for the specific club.
 */
export const canManageClubDetails = (
  getClubId: (req: Request) => string | Promise<string>
) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) throw new ForbiddenError('Unauthorized access');
      const clubId = await getClubId(req);
      if (!clubId) throw new ForbiddenError('Club ID is required for this operation');

      await withUserContext(req.user.id, async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: req.user!.id },
          select: { globalRole: true },
        });

        if (!user) throw new ForbiddenError('User not found');

        if (['PLATFORM_ADMIN', 'FACULTY_ADMIN'].includes(user.globalRole)) {
          return;
        }

        const membership = await tx.clubMembership.findFirst({
          where: {
            clubId,
            userId: req.user!.id,
            deletedAt: null,
            role: 'CLUB_ADMIN',
          },
        });

        if (!membership) {
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
 * Ensures the authenticated user can view club oversight data (Analytics, Disputes, Leaderboard).
 * Allows PLATFORM_ADMIN, FACULTY_ADMIN globally.
 * Allows CLUB_ADMIN, CORE_MEMBER, and FACULTY_MENTOR for the specific club.
 */
export const canViewClubOversight = (
  getClubId: (req: Request) => string | Promise<string>
) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) throw new ForbiddenError('Unauthorized access');
      const clubId = await getClubId(req);
      if (!clubId) throw new ForbiddenError('Club ID is required for this operation');

      await withUserContext(req.user.id, async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: req.user!.id },
          select: { globalRole: true },
        });

        if (!user) throw new ForbiddenError('User not found');

        if (['PLATFORM_ADMIN', 'FACULTY_ADMIN'].includes(user.globalRole)) {
          return;
        }

        const membership = await tx.clubMembership.findFirst({
          where: {
            clubId,
            userId: req.user!.id,
            deletedAt: null,
            role: { in: ['CLUB_ADMIN', 'CORE_MEMBER', 'FACULTY_MENTOR'] },
          },
        });

        if (!membership) {
          throw new ForbiddenError('Insufficient club role for oversight');
        }
      });

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Ensures the authenticated user can manage club memberships.
 * Allows PLATFORM_ADMIN globally, and specified roles (default: CLUB_ADMIN) for the specific club.
 * Excludes FACULTY_ADMIN from global bypass.
 */
export const canManageClubMembers = (
  getClubId: (req: Request) => string | Promise<string>,
  allowedRoles: ClubRole[] = ['CLUB_ADMIN']
) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) throw new ForbiddenError('Unauthorized access');
      const clubId = await getClubId(req);
      if (!clubId) throw new ForbiddenError('Club ID is required for this operation');

      await withUserContext(req.user.id, async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: req.user!.id },
          select: { globalRole: true },
        });

        if (!user) throw new ForbiddenError('User not found');

        if (user.globalRole === 'PLATFORM_ADMIN') {
          return;
        }

        const membership = await tx.clubMembership.findFirst({
          where: {
            clubId,
            userId: req.user!.id,
            deletedAt: null,
            role: { in: allowedRoles },
          },
        });

        if (!membership) {
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
 * Ensures the authenticated user can manage events.
 * Allows PLATFORM_ADMIN, FACULTY_ADMIN globally.
 * Allows specified roles (default: CLUB_ADMIN, CORE_MEMBER) in the PRIMARY club of the event.
 */
export const canManageEvent = (
  getEventId: (req: Request) => string | Promise<string>,
  allowedRoles: ClubRole[] = ['CLUB_ADMIN', 'CORE_MEMBER']
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

        if (['PLATFORM_ADMIN', 'FACULTY_ADMIN'].includes(user.globalRole)) {
          return;
        }

        const hasRole = await tx.eventClub.findFirst({
          where: {
            eventId,
            isPrimary: true, // MUST BE PRIMARY CLUB
            club: {
              memberships: {
                some: {
                  userId: req.user!.id,
                  deletedAt: null,
                  role: { in: allowedRoles },
                },
              },
            },
          },
        });

        if (!hasRole) {
          throw new ForbiddenError('Insufficient primary club role for this event');
        }
      });

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Ensures the authenticated user can approve events.
 * Allows PLATFORM_ADMIN, FACULTY_ADMIN globally.
 * Allows FACULTY_MENTOR in the PRIMARY club of the event.
 */
export const canApproveEvent = (
  getEventId: (req: Request) => string | Promise<string>
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

        if (['PLATFORM_ADMIN', 'FACULTY_ADMIN'].includes(user.globalRole)) {
          return;
        }

        const hasRole = await tx.eventClub.findFirst({
          where: {
            eventId,
            isPrimary: true,
            club: {
              memberships: {
                some: {
                  userId: req.user!.id,
                  deletedAt: null,
                  role: 'FACULTY_MENTOR',
                },
              },
            },
          },
        });

        if (!hasRole) {
          throw new ForbiddenError('Insufficient primary club role for this event');
        }
      });

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Ensures the authenticated user can lock/unlock events.
 * Allows PLATFORM_ADMIN, FACULTY_ADMIN globally.
 * Allows CLUB_ADMIN, CORE_MEMBER, FACULTY_MENTOR in the PRIMARY club of the event.
 */
export const canLockEvent = (
  getEventId: (req: Request) => string | Promise<string>
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

        if (['PLATFORM_ADMIN', 'FACULTY_ADMIN'].includes(user.globalRole)) {
          return;
        }

        const hasRole = await tx.eventClub.findFirst({
          where: {
            eventId,
            isPrimary: true,
            club: {
              memberships: {
                some: {
                  userId: req.user!.id,
                  deletedAt: null,
                  role: { in: ['CLUB_ADMIN', 'CORE_MEMBER', 'FACULTY_MENTOR'] },
                },
              },
            },
          },
        });

        if (!hasRole) {
          throw new ForbiddenError('Insufficient primary club role for this event');
        }
      });

      next();
    } catch (error) {
      next(error);
    }
  };
};
