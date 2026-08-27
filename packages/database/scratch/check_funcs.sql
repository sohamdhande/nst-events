SELECT 
    proname, 
    prosecdef,
    pg_get_functiondef(oid)
FROM pg_proc 
WHERE proname IN ('current_user_id', 'current_user_global_role');
