-- Enable PostGIS spatial extension & PGMQ messaging queue on initialization
CREATE EXTENSION IF NOT EXISTS postgis CASCADE;
CREATE EXTENSION IF NOT EXISTS pgmq CASCADE;
