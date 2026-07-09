# Content Agent Dashboard — Project Brief

This file is the source of truth for who this project is for and how the
agents should think/write. Scripts and the dashboard copy pull from here.

## Who I am

- Instagram handle: **@shawon_sheikh**
- Niche: self-development for young Muslims — leadership development,
  public speaking, and mindset.
- Voice: blunt but articulate. Direct, no fluff, but well-put — not
  aggressive, not corporate. Speaks to the audience like a sharp older
  brother, not a motivational-poster account.

## Competitors (same niche)

- @doctordaanish
- @saffanabanana
- @lifeofdinoo_
- @birdtart01

## What the 5 agents do

1. **Ideator (Scout)** — watches my account + competitors' recent posts,
   flags content gaps and formats that are working right now in this niche.
2. **Hook & Script Writer** — turns an idea into a hook (first line/first
   3 seconds) and a short script, in my voice (blunt but articulate — no
   generic motivational filler).
3. **Planner** — lays out a daily/weekly posting calendar: what to post,
   which pillar (leadership / public speaking / mindset), and when.
4. **Analyst** — pulls real stats (followers, views, engagement) and ranks
   my all-time top posts and recent performance.
5. **DM Manager** — surfaces incoming DMs/comments that need a reply and
   drafts responses in my voice.

## Data rules

- Real data only, pulled via Apify's `instagram-scraper` actor
  (`resultsType: posts`), not the `instagram-profile-scraper`'s
  `latestPosts` field (it only returns recent posts, not full history —
  it will misidentify my top post).
- All tokens (Apify, Telegram) live in `.env`, which is gitignored. Never
  print or commit tokens.

## Project layout

- `scripts/` — Node scripts (data pull, ranking, Telegram sender, cron entrypoint)
- `dashboard/` — static dashboard (`index.html` + JS/CSS), reads `dashboard/data.json`
- `.env` — secrets (gitignored)
- `.env.example` — documents required env vars, safe to commit
