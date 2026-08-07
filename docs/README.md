# NST Events Documentation Portal

This is the canonical source of truth for the NST Events platform. All documentation resides in this directory and its subdirectories. 

The documentation is organized by domain ownership rather than technical implementation.

---

## 🏛 Architecture & Governance

### [Engineering](https://github.com/sohamdhande/nst-events-docs/tree/main/docs/engineering)
* **Purpose**: The constitutional laws and standards governing how software is built in this repository.
* **Ownership**: Principal Architect / Engineering Team.
* **Audience**: All contributors, AI Agents, Reviewers.
* **Relationship**: Overrides all other implementation documentation. Contains ADRs.

### [Architecture](./architecture/README.md)
* **Purpose**: High-level system diagrams, flowcharts, and structural documentation.
* **Ownership**: Architecture Team.
* **Audience**: Engineers, Product Managers.
* **Relationship**: Provides the visual mapping of the contracts defined in API and Database.

### [Security](https://github.com/sohamdhande/nst-events-docs/tree/main/docs/security)
* **Purpose**: Threat models, JWT strategies, and cryptographic signing guidelines.
* **Ownership**: Security Team / Platform Admins.
* **Audience**: Backend Engineers, Security Auditors.
* **Relationship**: Secures the boundaries defined in Database and API.

---

## 💻 Systems & Implementation

### [API](./api/README.md)
* **Purpose**: API routing matrices, edge function logic, and RPC contracts.
* **Ownership**: Backend Engineering.
* **Audience**: Frontend Engineers, Mobile Engineers.
* **Relationship**: Consumed by Mobile and Dashboard.

### [Backend](https://github.com/sohamdhande/nst-events-docs/tree/main/docs/backend)
* **Purpose**: Node.js worker implementation, core job logic, and event scheduling.
* **Ownership**: Backend Engineering.
* **Audience**: Backend Engineers, DevOps.
* **Relationship**: Executes long-running tasks for the API.

### [Database](./database/README.md)
* **Purpose**: Prisma schemas, Row-Level Security (RLS) policies, and indexing strategies.
* **Ownership**: Database Administrators / Backend Engineering.
* **Audience**: All Engineers.
* **Relationship**: The foundational layer for Security and Backend.

---

## 📱 Product & Interfaces

### [Product](https://github.com/sohamdhande/nst-events-docs/tree/main/docs/product)
* **Purpose**: Feature specifications, leaderboard scoring rules, and role definitions.
* **Ownership**: Product Management.
* **Audience**: All Stakeholders, Engineers.
* **Relationship**: Defines *what* needs to be built across all surfaces.

### [Mobile](https://github.com/sohamdhande/nst-events-docs/tree/main/docs/mobile)
* **Purpose**: React Native / Expo architecture, navigation state, and user flows.
* **Ownership**: Mobile Engineering.
* **Audience**: Mobile Engineers, Designers.
* **Relationship**: Consumes the API and Frontend Design System.

### [Dashboard](https://github.com/sohamdhande/nst-events-docs/tree/main/docs/dashboard)
* **Purpose**: Next.js administration web interface, operations mode, and analytics.
* **Ownership**: Frontend Engineering.
* **Audience**: Frontend Engineers, Club Admins.
* **Relationship**: Consumes the API and Frontend Design System.

### [Frontend Design System](https://github.com/sohamdhande/nst-events-docs/tree/main/docs/frontend)
* **Purpose**: Shared UI components, typography, design tokens, and accessibility standards.
* **Ownership**: Design / Frontend Engineering.
* **Audience**: Frontend and Mobile Engineers.
* **Relationship**: Defines the visual implementation for Mobile and Dashboard.

---

## ⚙️ Operations & Support

### [Operations](https://github.com/sohamdhande/nst-events-docs/tree/main/docs/operations)
* **Purpose**: Historical meeting notes, sprint planning, and non-technical coordination.
* **Ownership**: Project Management.
* **Audience**: Product Managers, Leads.
* **Relationship**: Supports product delivery.

### [Templates](https://github.com/sohamdhande/nst-events-docs/tree/main/docs/templates)
* **Purpose**: Standardized markdown templates for ADRs, meetings, and feature specs.
* **Ownership**: Engineering.
* **Audience**: Document Authors.
* **Relationship**: Used to bootstrap new documents.

### [Assets](https://github.com/sohamdhande/nst-events-docs/tree/main/docs/assets)
* **Purpose**: Centralized storage for diagrams, SVGs, logos, and shared images.
* **Ownership**: Design / Architecture.
* **Audience**: Document Authors.
* **Relationship**: Embedded across all documentation.

### [Archive](https://github.com/sohamdhande/nst-events-docs/tree/main/docs/archive)
* **Purpose**: Storage for deprecated, superseded, or historical documents.
* **Ownership**: Engineering.
* **Audience**: Historians, Auditors.
* **Relationship**: Replaces deleted knowledge to prevent context loss.

---

For the high-level project overview, see [PROJECT_CONTEXT.md](https://github.com/sohamdhande/nst-events-docs).
