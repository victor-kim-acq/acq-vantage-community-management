# Topic Classification Prompt

## Instructions
You are classifying community posts and comments from the ACQ Vantage business/marketing Skool community.

For each item, determine:
1. PRIMARY TOPIC — what the person is actually discussing (not surface keywords)
2. ROLE — whether this person is giving help/value or seeking help/asking questions

## Topics (pick ONE):
- **paid_ads**: Running ads on Meta/Google/LinkedIn, ad creatives, campaign setup, retargeting, ad spend optimization
- **content_organic**: YouTube, Instagram reels, TikTok, posting strategy, viral content, personal branding, audience growth
- **lead_gen_funnels**: Landing pages, VSLs, lead magnets, conversion optimization, quiz funnels, webinars, booking calls
- **email_outreach**: Email sequences, cold outreach, cold DMs, list building, list swaps, newsletters
- **ai_tools**: ACQ AI, ChatGPT, Claude, automation tools, GHL/GoHighLevel, Zapier, ManyChat, prompt engineering
- **sales_offers**: Pricing, offer creation, sales calls, closing techniques, objections, high-ticket positioning
- **tracking_analytics**: Attribution, CAC/LTV, metrics, Hyros, UTM tracking, data analysis, measuring results
- **scaling_strategy**: Affiliates, ambassadors, partnerships, referrals, hiring, delegation, growth systems
- **hiring**: Specifically about recruiting, finding people, hiring for roles
- **operations**: Internal systems, SOPs, team management, project management, fulfillment
- **conversational**: Thank yous, encouragement, tagging others, brief reactions, emojis-only, social niceties with NO substantive content

## Roles (pick ONE):
- **giver**: Sharing resources, tutorials, answering questions, providing strategic advice, teaching, helping others
- **seeker**: Asking questions, requesting feedback, looking for help, expressing a problem they need solved
- **neutral**: Brief social interaction OR balanced mix of both (use sparingly)

## Critical Rules
- Read the ACTUAL MEANING, not keywords. "I want to learn paid ads" = seeker. "Here's my paid ads guide" = giver.
- For comments, consider: is this person adding value/answering, or asking follow-up questions?
- "conversational" is ONLY for content with zero substantive information (pure social interaction)
- Short encouraging comments like "Great post!" with no added insight = conversational + neutral
- If someone shares a win AND asks for advice, classify as seeker.

## Input Format
Content will be provided in batches of up to 10 items:
```
[0] Type: post | Post ID: xxx
Title: ...
Content: ...
---
[1] Type: comment | Post ID: xxx
Title:
Content: ...
---
```

## Output Format
Respond with ONLY valid JSON array, no other text:
```json
[{"id": 0, "topic": "topic_name", "role": "giver/seeker/neutral", "reasoning": "one sentence why"}]
```

## Edge Case Examples

### "I want to learn about Meta ads" → seeker + paid_ads
Not a giver just because they mention ads. They're seeking knowledge.

### "Here's my 5-step process for cold email" → giver + email_outreach
Teaching others = giver, regardless of whether they ask a question at the end.

### "🙌🔥" → neutral + conversational
Pure reaction with no substantive content.

### "Great breakdown! I'd also add that retargeting works better with..." → giver + paid_ads
Starts conversational but adds real value = giver, classified by the substantive topic.

### "Has anyone tried using ChatGPT to write ad copy?" → seeker + ai_tools
Primary intent is the AI tool question, even though ads are mentioned.
