# 04 Event Lifecycle

This state diagram models the transition states an event undergoes from creation to completion, detailing which roles possess the authority to execute specific state transitions.

```mermaid
graph TD
    classDef draft fill:#f3f4f6,stroke:#9ca3af,stroke-width:2px,color:#374151
    classDef pending fill:#fef08a,stroke:#eab308,stroke-width:2px,color:#854d0e
    classDef published fill:#bbf7d0,stroke:#22c55e,stroke-width:2px,color:#166534
    classDef archived fill:#e5e7eb,stroke:#6b7280,stroke-width:2px,color:#1f2937
    classDef startNode fill:#333,stroke:#333,color:#fff,shape:circle

    Start(( )):::startNode
    Draft["DRAFT"]:::draft
    Pending["PENDING APPROVAL"]:::pending
    Published["PUBLISHED"]:::published
    Archived["ARCHIVED"]:::archived

    Start -->|Club Admin Creates| Draft
    Draft -->|Club Admin Submits| Pending
    Pending -->|Mentor Approves| Published
    Published -->|Event Completes| Archived
    
    Pending -.->|Mentor Rejects| Draft
    Published -.->|Admin Cancels| Draft
```
