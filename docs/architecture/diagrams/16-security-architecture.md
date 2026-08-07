# 16 Security Model

This overview displays the zero-trust security architecture, showing how authentication, roles, Row Level Security, and audit logging protect platform data.

```mermaid
graph TD
    Auth["Google OAuth Authentication"] --> JWT["JWT Token Generated"]
    
    JWT --> Middleware["Role Resolution Middleware"]
    
    Middleware --> API["API & RPC Layer"]
    
    API --> RLS["Row Level Security (RLS) Policies"]
    
    RLS -->|Permits Read/Write| DB[("Database")]
    RLS -->|Denies Access| AuditLog["Security Audit Logging"]
    
    DB --> AuditLog[Action Audit Logging]
    
    subgraph Database Security
        SecDef[Security Definer RPCs] --> DB
    end
    API --> SecDef
```
