-- SQL Migration required to map Mixpanel (Warehouse Connector) seamlessly.
-- This does not modify any historical data, nor existing tables. It simply provisions read-only access.
-- The password 'PASTE_SECURE_PASSWORD_HERE' must be replaced prior to execution by DB Admin.

CREATE USER mixpanel_reader WITH PASSWORD 'PASTE_SECURE_PASSWORD_HERE';

-- Grant usage on the schema so the user can interact using SELECT
GRANT USAGE ON SCHEMA public TO mixpanel_reader;

-- Securely grant read-only specific tables/views
GRANT SELECT ON "registered_voters" TO mixpanel_reader;
GRANT SELECT ON "user_activities" TO mixpanel_reader;

-- Optional: Explicitly block write access to avoid any UI mistakes (already denied by default due to read-only spec but enforced for security)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM mixpanel_reader;
