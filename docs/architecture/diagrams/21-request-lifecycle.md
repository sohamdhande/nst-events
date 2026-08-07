# 21 End-to-End Request Lifecycle

This sequence diagram exemplifies a complete request lifecycle, specifically detailing a student registering for an event, traversing from the client to the database.

```mermaid
sequenceDiagram
    participant Student
    participant Mobile as Mobile App
    participant API as Express API
    participant RBAC as RBAC Middleware
    participant RPC as PostgreSQL RPC
    participant DB as Database

    Student->>Mobile: Clicks "Register"
    Mobile->>API: POST /events/:id/register
    API->>RBAC: Verify JWT & Resolve Role
    alt Unauthorized
        RBAC-->>API: 403 Forbidden
        API-->>Mobile: Error Message
    else Authorized
        RBAC->>RPC: Call register_event()
        RPC->>DB: Atomic Capacity Update (registration_count + 1)
        DB->>DB: Check Constraints
        alt Full
            DB->>DB: Create Waitlist Record
            DB-->>RPC: Waitlisted Status
        else Available
            DB->>DB: Create Registration Record
            DB-->>RPC: Registered Status
        end
        RPC-->>RBAC: Success Result
        RBAC-->>API: 200 OK / Response Payload
        API-->>Mobile: Update UI Status
        Mobile-->>Student: Show Success/Waitlist
    end
```
