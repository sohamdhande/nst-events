# 02 Role Hierarchy

This diagram details the hierarchical structure of user roles within NST-Connect, including their inheritance and authority. Platform Admins hold supreme authority, while Faculty and Club Admins manage their respective domains down to individual students.

```mermaid
graph TD
    PlatformAdmin[Platform Admin] --> FacultyAdmin[Faculty Admin]
    PlatformAdmin --> ClubAdmin[Club Admin]
    
    FacultyAdmin --> FacultyMentor[Faculty Mentor]
    
    FacultyMentor --> ClubAdmin
    
    ClubAdmin --> CoreMember[Core Member]
    CoreMember --> Member[Member]
    Member --> Student[Student]
    
    classDef admin fill:#ff4d4d,color:#fff,stroke:#cc0000,stroke-width:2px;
    classDef faculty fill:#ff9933,color:#fff,stroke:#cc6600,stroke-width:2px;
    classDef club fill:#33cc33,color:#fff,stroke:#009900,stroke-width:2px;
    classDef student fill:#3399ff,color:#fff,stroke:#0066cc,stroke-width:2px;
    
    class PlatformAdmin admin;
    class FacultyAdmin,FacultyMentor faculty;
    class ClubAdmin,CoreMember club;
    class Member,Student student;
```
