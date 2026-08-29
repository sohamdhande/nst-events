import { CurrentUser } from '../hooks/useCurrentUser';
import { Event } from '../hooks/useEvents';

export function isPlatformAdmin(user?: CurrentUser | null): boolean {
  return user?.global_role === 'PLATFORM_ADMIN';
}

export function isFacultyAdmin(user?: CurrentUser | null): boolean {
  return user?.global_role === 'FACULTY_ADMIN';
}

export function canManageClubDetails(user: CurrentUser | null | undefined, clubId: string): boolean {
  if (!user) return false;
  if (isPlatformAdmin(user) || isFacultyAdmin(user)) return true;
  return user.club_memberships.some((m) => m.club_id === clubId && m.role === 'CLUB_ADMIN');
}

export function canManageClubMemberships(user: CurrentUser | null | undefined, clubId: string): boolean {
  if (!user) return false;
  if (isPlatformAdmin(user)) return true;
  return user.club_memberships.some((m) => m.club_id === clubId && m.role === 'CLUB_ADMIN');
}

export function canViewStudentDirectory(user?: CurrentUser | null): boolean {
  if (!user) return false;
  return isPlatformAdmin(user) || isFacultyAdmin(user);
}

export function canManageStudentDirectory(user?: CurrentUser | null): boolean {
  return isPlatformAdmin(user);
}

export type TargetUser = {
  id?: string;
  globalRole?: string;
  clubMemberships?: any[];
};

export function canChangeAcademicBatch(actor: CurrentUser | null | undefined, target: TargetUser | null | undefined): boolean {
  if (!actor || !target) return false;
  
  const isPlatform = isPlatformAdmin(actor);
  const isFaculty = isFacultyAdmin(actor);
  
  if (!isPlatform && !isFaculty) return false;

  // We determine if the target is explicitly a STUDENT and not an administrator.
  // If globalRole is missing from the payload (e.g. AuthorizedStudent), we cannot safely determine
  // if they are a Club Admin, so we treat their administrative status as UNKNOWN and strictly restrict it.
  const hasGlobalRole = typeof target.globalRole === 'string';
  const targetRole = target.globalRole;
  const isClubAdmin = Array.isArray(target.clubMemberships) && target.clubMemberships.length > 0;
  
  // A target is considered a pure STUDENT if we explicitly know they have the STUDENT global role
  // AND we know they have no club memberships.
  const isTargetStudent = hasGlobalRole && targetRole === 'STUDENT' && !isClubAdmin;

  // Only permit academic batch change if the target is definitively a STUDENT.
  // Both PLATFORM_ADMIN and FACULTY_ADMIN are subject to this restriction for administrative targets.
  if (isTargetStudent) {
    return true;
  }
  
  return false;
}

export function canChangeGlobalRole(actor: CurrentUser | null | undefined, target: TargetUser | null | undefined): boolean {
  if (!actor || !target) return false;
  if (!isPlatformAdmin(actor)) return false;
  
  // Target transition rules
  if (!target.globalRole) return false; // Only valid for users with a known global role
  
  // Cannot demote/change self
  if (target.id && actor.id && target.id === actor.id) return false;
  
  // Can only change PLATFORM_ADMIN, FACULTY_ADMIN, FACULTY_MENTOR, or STUDENT
  const validRoles = ['PLATFORM_ADMIN', 'FACULTY_ADMIN', 'FACULTY_MENTOR', 'STUDENT'];
  return validRoles.includes(target.globalRole);
}

export function canViewTargetClub(actor: CurrentUser | null | undefined, target: TargetUser | null | undefined): boolean {
  if (!actor || !target) return false;
  // Anyone with access to the Users page can view the club link if the target is a club admin
  const isClubAdmin = Array.isArray(target.clubMemberships) && target.clubMemberships.length > 0;
  return isClubAdmin;
}

export function canRevokeUserSessions(actor: CurrentUser | null | undefined, target: TargetUser | null | undefined): boolean {
  if (!actor || !target) return false;
  if (!isPlatformAdmin(actor)) return false;
  if (target.id && actor.id && target.id === actor.id) return false; // self-protection
  return true;
}

export function canViewAcademicCatalog(user?: CurrentUser | null): boolean {
  return isPlatformAdmin(user) || isFacultyAdmin(user);
}

export function canManageAcademicCatalog(user?: CurrentUser | null): boolean {
  return isPlatformAdmin(user);
}

export function canMarkAttendanceManually(user?: CurrentUser | null): boolean {
  return isPlatformAdmin(user);
}

export function canRecalculateLeaderboard(user?: CurrentUser | null): boolean {
  return isPlatformAdmin(user);
}

// Event Capability Helpers

function getPrimaryClubId(event: Event): string | undefined {
  return event.eventClubs?.find((ec) => ec.isPrimary)?.clubId;
}

export function canManageEvent(user: CurrentUser | null | undefined, event: Event): boolean {
  if (!user) return false;
  if (isPlatformAdmin(user) || isFacultyAdmin(user)) return true;
  
  const primaryClubId = getPrimaryClubId(event);
  if (!primaryClubId) return false;

  return user.club_memberships.some(
    (m) => m.club_id === primaryClubId && ['CLUB_ADMIN', 'CORE_MEMBER'].includes(m.role)
  );
}

export function canApproveEvent(user: CurrentUser | null | undefined, event: Event): boolean {
  if (!user) return false;
  if (isPlatformAdmin(user) || isFacultyAdmin(user)) return true;
  
  const primaryClubId = getPrimaryClubId(event);
  if (!primaryClubId) return false;

  return user.club_memberships.some(
    (m) => m.club_id === primaryClubId && m.role === 'FACULTY_MENTOR'
  );
}

export function canLockEvent(user: CurrentUser | null | undefined, event: Event): boolean {
  if (!user) return false;
  if (isPlatformAdmin(user) || isFacultyAdmin(user)) return true;
  
  const primaryClubId = getPrimaryClubId(event);
  if (!primaryClubId) return false;

  return user.club_memberships.some(
    (m) => m.club_id === primaryClubId && ['CLUB_ADMIN', 'CORE_MEMBER', 'FACULTY_MENTOR'].includes(m.role)
  );
}
