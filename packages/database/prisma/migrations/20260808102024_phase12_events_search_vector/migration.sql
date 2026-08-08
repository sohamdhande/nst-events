-- Phase 12 Backend Hardening - Events Full-Text Search
-- Adds generated tsvector column for fast text search

ALTER TABLE events 
ADD COLUMN search_vector tsvector 
GENERATED ALWAYS AS (
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
) STORED;

CREATE INDEX events_search_vector_idx ON events USING GIN (search_vector);
