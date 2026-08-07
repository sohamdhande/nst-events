# 07 Attendance System Architecture

This diagram illustrates the core components of the dynamic QR attendance system, highlighting the interplay between the session generation, scanning, location validation, and leaderboard impact.

```mermaid
graph TD
    Session["Attendance Session"] -->|Generates| TOTP["Dynamic QR Code (TOTP)"]
    
    subgraph Mobile App
        Scan["Student Scans QR"]
        Geo["Location Validation (Geofence)"]
    end
    
    TOTP --> Scan
    Scan --> Geo
    Geo --> ServerValidation
    
    subgraph Backend
        ServerValidation["Server Validation (HMAC, Geofence Check)"]
        Record["Attendance Record Created"]
        Leaderboard["Leaderboard Impact Calculated"]
    end
    
    ServerValidation -->|Success| Record
    Record --> Leaderboard
    
    ServerValidation -->|Failure| Dispute[Dispute System]
```
