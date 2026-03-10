# Member Profiling Logic

## Engagement Scoring
- Posts: (comments_count x 3) + upvotes
- Comments: (upvotes x 2) + 1

## Member Role Assignment
- Primary role: Most frequent role (giver/seeker/neutral)
- Activity level: total posts + total comments
- Primary topic: Most frequent topic (excluding conversational)

## Self-Reply Handling
When a post author comments on their own post:
- Do NOT count as "helping others" for giver classification
- Count as "engaging with responses"
- Detection: compare comment author with parent post author

## Member Segments
- Power Givers: 10+ activities, majority giver, 3+ topics
- Active Seekers: 5+ activities, majority seeker
- Topic Specialists: 70%+ activity in single topic
- Social Connectors: High conversational %, engage across many threads
- Lurkers: < 3 total activities
