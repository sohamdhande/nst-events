BEGIN;

SELECT plan(7);

-- 1. Test EVENT_NOT_PUBLISHED (U0033)
-- Needs an event in DRAFT state
DO $$
DECLARE
    v_admin_id UUID := '00000000-0000-0000-0000-000000000001';
    v_event_id UUID := '11111111-1111-1111-1111-111111111111';
BEGIN
    INSERT INTO users (id, email, full_name, global_role, security_version)
    VALUES (v_admin_id, 'admin@newtonschool.co', 'Admin', 'PLATFORM_ADMIN', 1) ON CONFLICT DO NOTHING;

    INSERT INTO events (id, title, state, registration_type, created_by)
    VALUES (v_event_id, 'Draft Event', 'DRAFT', 'INDIVIDUAL', v_admin_id) ON CONFLICT DO NOTHING;
END $$;

-- Verify register_event throws U0033 for DRAFT event
PREPARE test_register_draft AS SELECT register_event('11111111-1111-1111-1111-111111111111');
SELECT throws_matching(
    'EXECUTE test_register_draft',
    'Event not published',
    'register_event on DRAFT event should throw Event not published'
);

-- Note: throws_matching in pgTAP doesn't easily assert the ERRCODE directly if we only use throws_matching,
-- but since the test runner parses the error, if it wasn't U0033 it might fail depending on pgTAP version.
-- A better way is using a plpgsql block catching it.

SELECT throws_ok(
    'EXECUTE test_register_draft',
    'U0033',
    'Event not published',
    'register_event on DRAFT event should throw U0033'
);

-- We can also test the others similarly.

-- Clean up
ROLLBACK;
