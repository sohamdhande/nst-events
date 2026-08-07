# 03 Club Architecture

This diagram visualizes the ownership and relationship structures within a Club. It shows how Faculty Mentors and Club Admins govern the club, which in turn manages events, announcements, and its member hierarchy.

```mermaid
graph TD
    FacultyMentor[Faculty Mentor] -->|Oversees| Club[Club Entity]
    ClubAdmin[Club Admin] -->|Manages| Club
    
    Club -->|Contains| CoreMembers[Core Members]
    Club -->|Contains| Members[General Members]
    
    CoreMembers -->|Assists| ClubAdmin
    
    Club -->|Hosts| Events[Events]
    Club -->|Publishes| Announcements[Announcements]
    
    Events -->|Target| Members
    Announcements -->|Target| Members
```
