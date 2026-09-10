-- The standalone migration CLI connects as the schema owner but performs all
-- data reads and writes after explicitly assuming the RLS-constrained runtime
-- role. NOINHERIT on both roles prevents implicit privilege inheritance.
grant steady_runtime to steady_migration_owner;
