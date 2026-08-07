# 20 Codebase Architecture

This diagram breaks down the development architecture, detailing the specific technologies used across the monorepo for the frontend clients, backend, and shared components.

```mermaid
graph TD
    subgraph Monorepo
        subgraph Apps
            Expo["Expo React Native App"]
            NextJS["Web Dashboard (Next.js)"]
        end

        subgraph Packages
            Types["Shared Prisma-generated Types"]
            UI["Shared Design System & Components"]
        end
    end

    subgraph Express API Service
        Auth["Google OAuth via Express"]
        RBAC["RBAC Middleware"]
        Routes["Express Route Handlers"]
    end

    subgraph Notification Worker Service
        Worker["Background Worker (native queue)"]
    end

    subgraph Infrastructure
        DB[("PostgreSQL Database")]
        Storage["File Storage (Deferred — Not in V1)"]
    end

    Expo --> Types
    NextJS --> Types

    Expo --> UI
    NextJS --> UI

    Expo -->|REST API| Routes
    NextJS -->|REST API| Routes

    Routes --> RBAC
    RBAC --> DB

    Worker -->|native queue polling| DB

    classDef app fill:#e0f2fe,stroke:#0284c7,stroke-width:2px,color:#0c4a6e;
    classDef pkg fill:#fef08a,stroke:#ca8a04,stroke-width:2px,color:#713f12;
    classDef sba fill:#dcfce7,stroke:#16a34a,stroke-width:2px,color:#14532d;

    class Expo,NextJS app;
    class Types,UI pkg;
    class Auth,RBAC,Routes,Worker,DB,Storage sba;
```
