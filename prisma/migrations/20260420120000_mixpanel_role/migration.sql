-- SQL Migration for Mixpanel Warehouse Connector
-- Open-Source Friendly Approach: Role creation without a password payload.
-- The mixpanel_reader role is created without a predefined password.
-- In production (e.g. Railway), the DBA will assign a password manually:
-- ALTER USER mixpanel_reader WITH PASSWORD 'strong_password';

CREATE USER mixpanel_reader;

-- Grant usage on the schema
GRANT USAGE ON SCHEMA public TO mixpanel_reader;

-- Grant read-only access to required analytics views
GRANT SELECT ON "registered_voters" TO mixpanel_reader;
GRANT SELECT ON "user_activities" TO mixpanel_reader;

-- Best Practice: Ensure no mutation privileges can be inherited or misused
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM mixpanel_reader;
