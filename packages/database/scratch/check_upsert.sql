SELECT 
    proname, 
    prosecdef,
    pg_get_functiondef(oid)
FROM pg_proc 
WHERE proname IN ('upsert_oauth_user', 'can_see_user_as_organizer', 'has_club_role', 'is_active_club_member');
