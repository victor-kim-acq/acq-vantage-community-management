# Member Profiling Logic

## Engagement Scoring Formula
- **Posts**: (comments_count × 3) + upvotes
- **Comments**: (upvotes × 2) + 1

## Member Role Assignment
Based on aggregate semantic_role across all posts and comments:
- **Primary role**: Most frequent role (giver/seeker/neutral)
- **Activity level**: total posts + total comments
- **Primary topic**: Most frequent semantic_topic (excluding conversational)

## Self-Reply Handling
When a post author comments on their own post:
- Do NOT count this as "helping others" for giver classification
- Count it as "engaging with responses" — a separate engagement signal
- Detection: compare comment `created by` with the parent post's `created by` via matching `post id`

## Member Segments
- **Power Givers**: 10+ activities, majority role = giver, 3+ topics
- **Active Seekers**: 5+ activities, majority role = seeker
- **Topic Specialists**: 70%+ activity in single topic
- **Social Connectors**: High conversational %, engage across many threads
- **Lurkers**: < 3 total activities

## Matchmaking Logic

### Complementary Matches (Giver → Seeker)
- Find pairs where one is a giver and one is a seeker
- Must share at least one non-conversational topic
- Score = activity-weighted topic overlap
- Higher score when giver's primary topic matches seeker's primary topic

### Affinity Matches (Shared Interests)
- Find pairs with high topic overlap regardless of role
- Score = minimum activity count across shared topics
- Exclude conversational topic from matching
- Minimum 5 activities per member to qualify
