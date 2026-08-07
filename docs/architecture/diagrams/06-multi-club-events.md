# 06 Multi-Club Event Architecture

This diagram demonstrates the architecture for events hosted by multiple clubs, outlining primary ownership versus associated club participation and the resulting approval flows.

```mermaid
graph TD
    PrimaryClub[Primary Club] -->|Creates & Owns| Event[Multi-Club Event]
    AssociatedClub1[Associated Club A] -->|Participates| Event
    AssociatedClub2[Associated Club B] -->|Participates| Event
    
    Event --> ApprovalFlow[Approval Flow]
    
    PrimaryClubMentor[Primary Club Mentor] -->|Approves| ApprovalFlow
    AssociatedClubMentors[Associated Club Mentors] -->|May Need to Acknowledge| ApprovalFlow
    
    ApprovalFlow -->|Fully Approved| PublishedEvent[Published Event]
```
