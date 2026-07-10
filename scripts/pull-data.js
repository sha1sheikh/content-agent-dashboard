// Pulls real Instagram data via Apify's instagram-scraper actor and writes
// dashboard/data.json. Run with: node --env-file=.env scripts/pull-data.js
//
// Uses resultsType: "posts" (full post objects), never the
// instagram-profile-scraper's latestPosts field — that field only returns
// recent posts and will misidentify the all-time top post.

const fs = require("fs");
const path = require("path");

const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
if (!APIFY_TOKEN) {
  console.error("Missing APIFY_API_TOKEN in .env");
  process.exit(1);
}

const ACTOR = "apify~instagram-scraper";
const API_BASE = "https://api.apify.com/v2";

const MAX_RETRIES = 4;
const BASE_DELAY_MS = 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Apify runs can hit rate limits (429) or transient 5xx/network errors,
// especially with several sequential actor calls (profile + 5 accounts).
// Retry those with exponential backoff; anything else (bad input, auth,
// actor errors) fails immediately since retrying won't help.
function isRetryable(status) {
  return status === 429 || status >= 500;
}

const ME = { handle: "shawon_sheikh", limit: 200 };
const COMPETITORS = [
  { handle: "doctordaanish", limit: 30 },
  { handle: "saffanabanana", limit: 30 },
  { handle: "lifeofdinoo_", limit: 30 },
  { handle: "birdtart01", limit: 30 },
];

async function runActor(input) {
  const url = `${API_BASE}/acts/${ACTOR}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      const delay = BASE_DELAY_MS * 2 ** attempt;
      console.warn(`  network error (${err.message}), retrying in ${delay}ms...`);
      await sleep(delay);
      continue;
    }

    if (res.ok) return res.json();

    const text = await res.text();
    if (!isRetryable(res.status) || attempt === MAX_RETRIES) {
      throw new Error(`Apify run failed (${res.status}): ${text.slice(0, 500)}`);
    }
    const retryAfterHeader = Number(res.headers.get("retry-after"));
    const delay = retryAfterHeader > 0 ? retryAfterHeader * 1000 : BASE_DELAY_MS * 2 ** attempt;
    console.warn(`  Apify run failed (${res.status}), retrying in ${delay}ms...`);
    await sleep(delay);
  }
}

async function fetchProfileDetails(handle) {
  const items = await runActor({
    directUrls: [`https://www.instagram.com/${handle}/`],
    resultsType: "details",
    resultsLimit: 1,
  });
  return items[0] || null;
}

async function fetchPosts(handle, limit) {
  const items = await runActor({
    directUrls: [`https://www.instagram.com/${handle}/`],
    resultsType: "posts",
    resultsLimit: limit,
  });
  return items;
}

function normalizePost(raw) {
  const viewCount = raw.videoViewCount ?? raw.videoPlayCount ?? null;
  const likesCount = raw.likesCount ?? 0;
  const commentsCount = raw.commentsCount ?? 0;
  // Photos have no view count from Instagram. Use an engagement proxy so
  // photo posts can still be ranked alongside videos when no views exist.
  const engagementProxy = likesCount + commentsCount * 2;
  return {
    id: raw.id,
    url: raw.url,
    type: raw.type || raw.productType || "unknown",
    caption: (raw.caption || "").slice(0, 200),
    timestamp: raw.timestamp,
    likesCount,
    commentsCount,
    viewCount,
    engagementProxy,
  };
}

function rankPosts(posts) {
  const withViews = posts.filter((p) => p.viewCount != null);
  const withoutViews = posts.filter((p) => p.viewCount == null);
  withViews.sort((a, b) => b.viewCount - a.viewCount);
  withoutViews.sort((a, b) => b.engagementProxy - a.engagementProxy);
  return [...withViews, ...withoutViews];
}

async function main() {
  console.log(`Fetching profile details for @${ME.handle}...`);
  const meDetails = await fetchProfileDetails(ME.handle);

  console.log(`Fetching up to ${ME.limit} posts for @${ME.handle}...`);
  const mePostsRaw = await fetchPosts(ME.handle, ME.limit);
  const mePosts = rankPosts(mePostsRaw.map(normalizePost));

  const competitors = [];
  for (const c of COMPETITORS) {
    console.log(`Fetching up to ${c.limit} recent posts for @${c.handle}...`);
    const rawPosts = await fetchPosts(c.handle, c.limit);
    competitors.push({
      handle: c.handle,
      postsSampled: rawPosts.length,
      posts: rankPosts(rawPosts.map(normalizePost)),
    });
  }

  const followersCount = meDetails?.followersCount ?? null;
  const postsCountTotal = meDetails?.postsCount ?? null;

  const data = {
    fetchedAt: new Date().toISOString(),
    me: {
      handle: ME.handle,
      followersCount,
      followsCount: meDetails?.followsCount ?? null,
      postsCountTotal,
      postsSampled: mePosts.length,
      cappedSample: postsCountTotal != null && postsCountTotal > mePosts.length,
      posts: mePosts,
    },
    competitors,
  };

  const outPath = path.join(__dirname, "..", "dashboard", "data.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
  console.log(`\nWrote ${outPath}`);

  console.log(`\n@${ME.handle} — followers: ${followersCount}`);
  if (data.me.cappedSample) {
    console.log(
      `NOTE: account has ${postsCountTotal} total posts but only the ${mePosts.length} most recent were sampled — "top post" below is top-of-sample, not guaranteed all-time top.`
    );
  }
  const top = mePosts[0];
  if (top) {
    console.log(`Top post (sample): ${top.url}`);
    console.log(
      `  views: ${top.viewCount ?? "n/a"}, likes: ${top.likesCount}, comments: ${top.commentsCount}`
    );
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
