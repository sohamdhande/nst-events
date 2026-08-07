# Indexing Strategy

## BTree Indexes
* **Why**: Default index for equality and range queries.
* **Where**: Primary Keys, Foreign Keys (`user_id`, `event_id`), and timestamp columns like `start_time`.
* **Performance**: Accelerates Joins and `ORDER BY created_at` queries.

## GIN Indexes
* **Why**: Required for querying inside JSONB blobs and Full Text Search vectors.
* **Where**: `events.metadata`, `events.search_vector`, `clubs.search_vector`.
* **Accelerates**: Queries like `metadata->>'team_size_max' = '4'` or `title LIKE '%hack%'`.

## GiST Indexes
* **Why**: Specifically optimized for spatial data (PostGIS).
* **Where**: `events.location_geofence`.
* **Accelerates**: Geographic distance queries (`ST_DWithin`) used during attendance check-ins.

## Partial Indexes
* **Why**: To enforce constraints only on specific subsets of data.
* **Where**: Soft deletes. `CREATE UNIQUE INDEX unique_active_registration ON event_registrations (event_id, user_id) WHERE deleted_at IS NULL;`
* **Performance**: Keeps the index extremely small and fast.

## Composite Indexes
* **Why**: Multi-column lookups that happen frequently together.
* **Where**: `(session_id, user_id)` on `attendance_records`.
* **Accelerates**: Quickly verifying if a user has already checked in.
