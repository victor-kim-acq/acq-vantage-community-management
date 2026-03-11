# Classification Edge Cases — Decision Log

Real examples from the ACQ Vantage community where classification isn't obvious.
Use these as precedent when similar posts appear. Organized by the ambiguity pattern.

---

## Pattern: AI tool used for a specific domain task

**"How I Used AI to Rebuild My YouTube Thumbnail" — Gilbert Urbina**
- Ambiguity: ai_tools vs content_organic
- Decision: **ai_tools** + giver
- Why: The post teaches the AI workflow (ChatGPT Creative Studio, Nano Banana, prompting). YouTube is just the use case. Classify by what's being TAUGHT, not the domain it's applied to.

**"How I Build Internal Tools With Claude Code" — Aaron Figueroa**
- Ambiguity: ai_tools vs operations
- Decision: **ai_tools** + giver
- Why: The methodology IS the AI tool (Claude Code, sub-agents, CLAUDE.md guardrails). The internal tools are the output, not the topic.

**"Using AI to pull all my business data into one place" — Will Hetherington**
- Ambiguity: ai_tools vs tracking_analytics
- Decision: **ai_tools** + giver
- Why: The post is about using Cursor + Claude to BUILD a data system. If the post were about reading dashboards or interpreting metrics, it would be tracking_analytics. Building the tool = ai_tools.

**Rule: If the post is about HOW to use an AI tool, it's ai_tools. If AI is mentioned incidentally while discussing another topic, classify by the primary topic.**

---

## Pattern: Ad spend question that's really about metrics

**"Profitability" — Hayden Nielson**
- Ambiguity: paid_ads vs tracking_analytics
- Decision: **paid_ads** + seeker
- Why: Owns 4 game stores, spending $8.5K/month on Meta, asking whether to scale to $24K/month. The profitability math is in service of the ad spend decision. If the post were about building a dashboard or choosing attribution tools, it would be tracking_analytics.

**Rule: If the core decision is "should I spend more/less on ads," it's paid_ads even if they're asking about numbers. tracking_analytics is about the measurement infrastructure itself (tools, attribution models, dashboards).**

---

## Pattern: GHL / automation platform problems

**"GHL A2P Rejection Help" — Chris Kooken**
- Ambiguity: ai_tools vs email_outreach
- Decision: **ai_tools** + seeker
- Why: GHL (GoHighLevel) is explicitly listed under ai_tools in the topic definitions. The problem is platform configuration, not outreach strategy. If the post were "what should my SMS sequence say," it would be email_outreach.

**Rule: Platform/tool configuration issues → ai_tools. Strategy questions about what to send or who to target → email_outreach or lead_gen_funnels.**

---

## Pattern: Show-up rate / delivery problems

**"IOS update putting my outbound texts into spam" — Tim Matthews**
- Ambiguity: lead_gen_funnels vs email_outreach
- Decision: **lead_gen_funnels** + seeker
- Why: The core problem is show-up rate (funnel conversion), not list building or outreach strategy. The texts are appointment reminders, not cold outreach.

**Rule: If the problem is about converting leads who are already in the funnel (show rates, booking rates, follow-up sequences), it's lead_gen_funnels. If it's about reaching new people (cold email, cold DM, list building), it's email_outreach.**

---

## Pattern: Offer structure vs lead gen

**"DoorDash Clever Free Trial Hook" — David Edmonson**
- Ambiguity: sales_offers vs lead_gen_funnels
- Decision: **sales_offers** + giver
- Why: Sharing a retention/pricing tactic (golden handcuffs via delayed reward). This is offer design and pricing psychology, not lead generation mechanics.

**Rule: Offer creation, pricing, trial structure, and retention mechanics → sales_offers. Landing pages, VSLs, opt-in flows, and conversion optimization → lead_gen_funnels.**

---

## Pattern: Wealth / tax / entity structuring

**"Wealth Workshop" — Brandon Pierpont**
- Ambiguity: scaling_strategy vs no clear topic match
- Decision: **scaling_strategy** + seeker
- Why: Wealth building through entity structuring, IBC, Augusta Rule, IP LLCs — these are growth systems for the business owner. scaling_strategy covers partnerships, growth systems, and delegation. Wealth infrastructure qualifies.

**"Tax Guide 101 for Multifamily Investments" — Tony Hoong**
- Ambiguity: scaling_strategy vs conversational (just sharing notes)
- Decision: **scaling_strategy** + giver
- Why: Detailed tax guide with REPS rules, 750-hour requirements, material participation tests. This is substantive wealth/growth content, not a casual share.

**Rule: Substantive wealth building, entity structuring, or tax strategy for business owners → scaling_strategy. Casual mention of money or a motivational quote about success → conversational.**

---

## Pattern: Limiting beliefs / mindset posts

**"Working past limiting beliefs" — Anna LaGrew**
- Ambiguity: scaling_strategy vs conversational
- Decision: **scaling_strategy** + seeker
- Why: Runs a tax practice, seeking coaching to unblock growth. The limiting beliefs are the business blocker, not a motivational topic. The intent is business scaling.

**Rule: If the person has a business context and is asking about mindset AS a growth blocker, it's scaling_strategy. If it's a generic "believe in yourself" post with no business context, it's conversational.**

---

## Pattern: Diane McCracken quote shares (recurring)

Diane frequently shares quotes/tweets from Alex, Leila, or Sharran. Classification depends on how much original context she adds:

**Just a quote + tweet link (no original insight)**
- "Sharran" (multiple) — sharing a tweet with 1-2 quoted lines
- Decision: **conversational** + neutral
- Why: Zero original content. The quote may be substantive but Diane isn't teaching or asking.

**Quote + context that extracts lessons**
- "Sharran - Why 90% of Entrepreneurs Fail" — includes explanation of the 'quiet entrepreneur problem' and visibility strategy
- Decision: **content_organic** + giver
- Why: Enough original framing that it teaches about personal branding and visibility.

**Rule: Quote/tweet share with no original insight → conversational. Quote share with extracted lessons and business framing → classify by the topic of the lesson.**

---

## Pattern: Event logistics / resource sharing

**"[Links] Director Q&A: Ned Arick (2/24)" — Kevin Gong**
- Decision: **conversational** + neutral
- Why: Posting recording links and transcript. No original teaching, just logistics.

**"External Recording Link & Password: Profit Workshop" — Greg Martin**
- Decision: **conversational** + neutral (not seeker)
- Why: Administrative request for access. Not seeking business advice.

**"This week's accountability call is canceled!" — Kevin Gong**
- Decision: **conversational** + neutral
- Why: Community announcement, pure logistics.

**Rule: Event links, recording shares, schedule changes, access requests → conversational + neutral. Even if the event itself is substantive, the POST is just logistics.**

---

## Pattern: Content strategy for a specific business

**"I sold my last company for 7 figures" — Gabe Helguera**
- Ambiguity: content_organic vs scaling_strategy
- Decision: **content_organic** + seeker
- Why: The core question is YouTube content strategy (what to post, how to attract the right audience). Scaling is the goal, but content is the lever he's asking about.

**Rule: If the question is "what content should I create / how should I grow my audience," it's content_organic even if the underlying goal is scaling.**

---

## Pattern: Accountability / community milestone posts

**"Accountability Thread: The End!" — Craig Anderson**
- Ambiguity: conversational vs scaling_strategy
- Decision: **conversational** + giver
- Why: Community milestone post reflecting on a 28-week accountability journey. Emotional and social, no tactical advice.

**Rule: Accountability check-ins, community milestones, farewell posts, and journey reflections → conversational even if they mention business results.**

---

## Pattern: Hiring a specific role

**"Any Recommendations for a PT ecommerce marketing operator" — Lane George**
- Ambiguity: hiring vs operations vs email_outreach
- Decision: **hiring** + seeker
- Why: Looking for a specific person to fill a role. Even though the role involves email and ecommerce, the post is about FINDING the person.

**Rule: If the core ask is "who should I hire / where do I find this person," it's hiring regardless of what the role does.**
