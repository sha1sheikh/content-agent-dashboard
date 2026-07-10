// Uses Claude to turn real Instagram performance data (dashboard/data.json)
// into video ideas and per-post suggestions, in the voice/niche defined in
// CLAUDE.md. Run with: node --env-file=.env scripts/generate-insights.js
//
// Requires dashboard/data.json to already exist — run scripts/pull-data.js first.

const fs = require("fs");
const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY in .env");
  process.exit(1);
}

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const DATA_PATH = path.join(__dirname, "..", "dashboard", "data.json");
const CLAUDE_MD_PATH = path.join(__dirname, "..", "CLAUDE.md");
const OUT_PATH = path.join(__dirname, "..", "dashboard", "insights.json");

const MY_TOP_N = 15;
const COMPETITOR_TOP_N = 5;
const SUGGESTIONS_COUNT = 5;

function summarizePost(p) {
  return {
    type: p.type,
    date: p.timestamp ? p.timestamp.slice(0, 10) : null,
    caption: p.caption,
    views: p.viewCount,
    likes: p.likesCount,
    comments: p.commentsCount,
    url: p.url,
  };
}

const SCHEMA = {
  type: "object",
  properties: {
    videoIdeas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          hook: { type: "string" },
          pillar: { type: "string", enum: ["leadership", "public speaking", "mindset"] },
          rationale: { type: "string" },
          script: { type: "string" },
          visuals: {
            type: "object",
            properties: {
              setting: { type: "string" },
              visualHook: { type: "string" },
              otherHookIdeas: { type: "array", items: { type: "string" } },
            },
            required: ["setting", "visualHook", "otherHookIdeas"],
            additionalProperties: false,
          },
        },
        required: ["title", "hook", "pillar", "rationale", "script", "visuals"],
        additionalProperties: false,
      },
    },
    postSuggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          postUrl: { type: "string" },
          whatsWorking: { type: "string" },
          whatToImprove: { type: "string" },
        },
        required: ["postUrl", "whatsWorking", "whatToImprove"],
        additionalProperties: false,
      },
    },
  },
  required: ["videoIdeas", "postSuggestions"],
  additionalProperties: false,
};

async function main() {
  if (!fs.existsSync(DATA_PATH)) {
    console.error(`Missing ${DATA_PATH} — run scripts/pull-data.js first.`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  const brief = fs.readFileSync(CLAUDE_MD_PATH, "utf8");

  const summary = {
    me: {
      handle: data.me.handle,
      followersCount: data.me.followersCount,
      topPosts: data.me.posts.slice(0, MY_TOP_N).map(summarizePost),
    },
    competitors: data.competitors.map((c) => ({
      handle: c.handle,
      topPosts: c.posts.slice(0, COMPETITOR_TOP_N).map(summarizePost),
    })),
  };

  console.log("Asking Claude for video ideas, scripts, and post suggestions...");
  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 8192,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "high",
      format: { type: "json_schema", schema: SCHEMA },
    },
    system: [
      {
        type: "text",
        text: `Project brief (voice, niche, competitors, content pillars):\n\n${brief}`,
      },
    ],
    messages: [
      {
        role: "user",
        content:
          `Here is real recent Instagram performance data for me and my competitors, including my actual captions:\n\n${JSON.stringify(summary, null, 2)}\n\n` +
          `Based on this data and my voice/niche from the brief:\n` +
          `1. Propose 6 new video ideas. For each one, give:\n` +
          `   - a hook (first line/first 3 seconds), which content pillar it belongs to, and why it's timely (a format that's working right now, for me or a competitor, or a gap in what I'm currently posting)\n` +
          `   - a full short-form video script (the actual words to say, hook through close) written in my voice — study the tone, syntax, and subject matter of my captions above and match it. Blunt but articulate, no generic motivational-poster filler, sounds like a sharp older brother talking, not a coach.\n` +
          `   - visual direction: the setting/environment to film in (e.g. what to wear, where, framing, energy), the visual hook for the first 3 seconds (what's on screen — on-screen text, an action, a prop, a cut — not just the spoken line), and 2-3 other hook techniques worth trying for this specific idea (pattern interrupt, cold open mid-action, on-screen text punchline, etc.)\n` +
          `2. For ${SUGGESTIONS_COUNT} of my posts above, give a specific "what's working" and "what to improve" note each, grounded in the actual caption and engagement numbers — not generic advice.`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock) {
    throw new Error(`No text block in response (stop_reason: ${response.stop_reason})`);
  }
  const insights = JSON.parse(textBlock.text);

  const output = {
    generatedAt: new Date().toISOString(),
    ...insights,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));
  console.log(`\nWrote ${OUT_PATH}`);
  console.log(
    `${output.videoIdeas.length} video ideas, ${output.postSuggestions.length} post suggestions`
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
