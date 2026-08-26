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
