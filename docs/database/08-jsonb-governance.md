# JSONB Governance

JSONB is powerful but can become a dumping ground. We strictly regulate what can be placed inside `events.metadata`.

## Allowed Data
* `speaker_links`: External URLs to speaker profiles.
* `sponsor_links`: Sponsor logos and names.
* `resources`: Google Drive links for workshop materials.
* `custom_forms`: Minor configuration (e.g., "T-shirt size requested?").
* `theme_settings`: Hex codes for custom event branding.

## Forbidden Data
* **Users**: Never store user arrays in JSONB. Use relational tables.
* **Permissions**: Never define who can edit an event in metadata.
* **Attendance**: Must be tracked in their respective strongly-typed tables.
* **Registrations**: Same as attendance.
* **Analytics**: Computed views only, never stored in JSONB.
* **Relationships**: No foreign keys disguised as JSON objects.
