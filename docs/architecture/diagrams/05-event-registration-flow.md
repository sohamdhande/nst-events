# 05 Event Registration Flow

This flowchart outlines the end-to-end student experience when registering for an event, emphasizing capacity checks, waitlisting, and attendance eligibility confirmation.

```mermaid
graph TD
    A[Discovery: Student views Event in App] --> B{Register Action}
    B -->|Clicks Register| C[Registration Request]
    C --> D{Capacity Check}
    
    D -->|Seats Available| E[Assign Seat]
    D -->|Event Full| F[Join Waitlist]
    
    E --> G[Confirmation Sent]
    F --> H[Waitlist Notification Sent]
    
    G --> I[Attendance Eligibility Granted]
    I --> J[Student can scan QR at event]
```
