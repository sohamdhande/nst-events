# 10 Merit-Based Leaderboard System

This diagram maps out the various components contributing to the merit-based leaderboard, showing how points from different activities aggregate to individual and club scores.

```mermaid
graph TD
    subgraph Sources
        Attendance[Event Attendance]
        Volunteer[Volunteering]
        Organizer[Organizing Events]
        Speaker[Speaking Engagements]
        Mentor[Mentoring]
        Competition[Competition Results]
    end
    
    Sources --> RPC[PostgreSQL RPC]
    RPC --> ScoresTable[(leaderboard_scores table)]
    
    ScoresTable -->|pg_cron staggered refresh| IndivMV[(student_leaderboard_mv)]
    ScoresTable -->|pg_cron staggered refresh| ClubMV[(club_leaderboard_mv)]
    
    IndivMV --> Individual[Individual Leaderboard API]
    ClubMV --> Club[Club Leaderboard API]
    
    Individual --> Rewards[Recognition & Rewards]
    Club --> Funding[Club Funding / Status]
```
