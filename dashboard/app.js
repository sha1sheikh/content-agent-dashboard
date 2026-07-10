const SERIES_COLORS = ["--series-1", "--series-2", "--series-3", "--series-4", "--series-5"];

function colorVar(i) {
  return getComputedStyle(document.documentElement).getPropertyValue(SERIES_COLORS[i]).trim();
}

function compactNumber(n) {
  if (n == null) return "n/a";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "className") node.className = v;
    else if (k === "attrs") for (const [ak, av] of Object.entries(v)) node.setAttribute(ak, av);
    else node[k] = v;
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

function tooltip() {
  const node = el("div", { className: "tooltip" });
  document.body.appendChild(node);
  return {
    show(x, y, valueText, labelText) {
      node.textContent = "";
      node.appendChild(el("div", { className: "tt-value", textContent: valueText }));
      node.appendChild(el("div", { className: "tt-label", textContent: labelText }));
      node.style.left = `${x + 14}px`;
      node.style.top = `${y + 14}px`;
      node.classList.add("visible");
    },
    hide() {
      node.classList.remove("visible");
    },
  };
}

// Horizontal bar chart. rows: [{ label, value, valueText, color }]
function renderBarChart(container, rows, tt) {
  // Scale so the longest bar leaves headroom for its own value label.
  const max = Math.max(...rows.map((r) => r.value), 1) * 1.25;
  for (const row of rows) {
    const pct = (row.value / max) * 100;
    const track = el("div", { className: "bar-track" });
    const fill = el("div", {
      className: "bar-fill",
      style: `width: ${pct}%; background: ${row.color};`,
      attrs: { tabindex: "0", role: "img", "aria-label": `${row.label}: ${row.valueText}` },
    });
    const value = el("div", { className: "bar-value", style: `left: ${pct}%;`, textContent: row.valueText });

    const onEnter = (e) => tt.show(e.clientX, e.clientY, row.valueText, row.label);
    fill.addEventListener("pointermove", onEnter);
    fill.addEventListener("pointerenter", onEnter);
    fill.addEventListener("focus", () => {
      const box = fill.getBoundingClientRect();
      tt.show(box.right, box.top, row.valueText, row.label);
    });
    fill.addEventListener("pointerleave", () => tt.hide());
    fill.addEventListener("blur", () => tt.hide());

    track.appendChild(fill);
    track.appendChild(value);
    container.appendChild(el("div", { className: "bar-row" }, [
      el("div", { className: "cat-label", title: row.label, textContent: row.label }),
      track,
    ]));
  }
}

function avgViews(posts) {
  const views = posts.filter((p) => p.viewCount != null).map((p) => p.viewCount);
  if (!views.length) return null;
  return Math.round(views.reduce((a, b) => a + b, 0) / views.length);
}

function renderStatTiles(container, data) {
  const tiles = [
    ["Followers", compactNumber(data.me.followersCount)],
    ["Following", compactNumber(data.me.followsCount)],
    ["Total posts", compactNumber(data.me.postsCountTotal)],
    ["Posts sampled", compactNumber(data.me.postsSampled)],
  ];
  for (const [label, value] of tiles) {
    container.appendChild(el("div", { className: "stat-tile" }, [
      el("div", { className: "label", textContent: label }),
      el("div", { className: "value", textContent: value }),
    ]));
  }
}

function renderTopPostsChart(container, tt, data) {
  const top = data.me.posts.slice(0, 10);
  const rows = top.map((p) => ({
    label: p.caption ? p.caption.slice(0, 40) : p.type,
    value: p.viewCount ?? p.engagementProxy,
    valueText: p.viewCount != null ? `${compactNumber(p.viewCount)} views` : `${compactNumber(p.engagementProxy)} eng.`,
    color: colorVar(0),
  }));
  renderBarChart(container, rows, tt);
}

function renderAccountComparisonChart(container, legend, tt, data) {
  const accounts = [
    { handle: data.me.handle, posts: data.me.posts },
    ...data.competitors.map((c) => ({ handle: c.handle, posts: c.posts })),
  ];
  const rows = accounts.map((a, i) => ({
    label: `@${a.handle}`,
    value: avgViews(a.posts) ?? 0,
    valueText: avgViews(a.posts) != null ? `${compactNumber(avgViews(a.posts))} avg views` : "n/a",
    color: colorVar(i),
  }));
  renderBarChart(container, rows, tt);

  accounts.forEach((a, i) => {
    legend.appendChild(el("span", {}, [
      el("span", { className: "swatch", style: `background: ${colorVar(i)};` }),
      `@${a.handle}`,
    ]));
  });
}

function renderTopPostsTable(container, data) {
  const table = el("table");
  table.appendChild(el("thead", {}, [
    el("tr", {}, [
      el("th", { className: "rank", textContent: "#" }),
      el("th", { textContent: "Date" }),
      el("th", { textContent: "Type" }),
      el("th", { className: "num", textContent: "Views" }),
      el("th", { className: "num", textContent: "Likes" }),
      el("th", { className: "num", textContent: "Comments" }),
      el("th", { textContent: "Link" }),
    ]),
  ]));
  const tbody = el("tbody");
  data.me.posts.slice(0, 10).forEach((p, i) => {
    tbody.appendChild(el("tr", {}, [
      el("td", { className: "rank", textContent: String(i + 1) }),
      el("td", { textContent: formatDate(p.timestamp) }),
      el("td", { textContent: p.type }),
      el("td", { className: "num", textContent: p.viewCount != null ? p.viewCount.toLocaleString() : "n/a" }),
      el("td", { className: "num", textContent: p.likesCount.toLocaleString() }),
      el("td", { className: "num", textContent: p.commentsCount.toLocaleString() }),
      el("td", {}, [el("a", { href: p.url, target: "_blank", rel: "noopener", textContent: "View post" })]),
    ]));
  });
  table.appendChild(tbody);
  container.appendChild(table);
}

function renderCompetitorTopPostsTable(container, data) {
  const table = el("table");
  table.appendChild(el("thead", {}, [
    el("tr", {}, [
      el("th", { textContent: "Account" }),
      el("th", { className: "num", textContent: "Top post views" }),
      el("th", { textContent: "Link" }),
    ]),
  ]));
  const tbody = el("tbody");
  data.competitors.forEach((c) => {
    const top = c.posts[0];
    tbody.appendChild(el("tr", {}, [
      el("td", { textContent: `@${c.handle}` }),
      el("td", { className: "num", textContent: top?.viewCount != null ? top.viewCount.toLocaleString() : "n/a" }),
      el("td", {}, [top ? el("a", { href: top.url, target: "_blank", rel: "noopener", textContent: "View post" }) : "—"]),
    ]));
  });
  table.appendChild(tbody);
  container.appendChild(table);
}

function renderVideoIdeas(container, ideas) {
  for (const idea of ideas) {
    const card = [
      el("div", { className: "pillar", textContent: idea.pillar }),
      el("div", { className: "title", textContent: idea.title }),
      el("div", { className: "hook", textContent: `"${idea.hook}"` }),
      el("div", { className: "rationale", textContent: idea.rationale }),
    ];

    if (idea.script || idea.visuals) {
      const details = el("details", { className: "idea-details" }, [
        el("summary", { textContent: "Script & shooting notes" }),
      ]);
      if (idea.script) {
        details.appendChild(el("div", { className: "script-block", textContent: idea.script }));
      }
      if (idea.visuals) {
        details.appendChild(el("div", { className: "visual-notes" }, [
          el("div", { className: "visual-row" }, [
            el("span", { className: "label", textContent: "Setting:" }),
            el("span", { textContent: idea.visuals.setting }),
          ]),
          el("div", { className: "visual-row" }, [
            el("span", { className: "label", textContent: "Visual hook:" }),
            el("span", { textContent: idea.visuals.visualHook }),
          ]),
          el("div", { className: "visual-row" }, [
            el("span", { className: "label", textContent: "Other hooks:" }),
            el("span", { textContent: (idea.visuals.otherHookIdeas || []).join(" · ") }),
          ]),
        ]));
      }
      card.push(details);
    }

    container.appendChild(el("div", { className: "idea-card" }, card));
  }
}

function renderPostSuggestions(container, suggestions) {
  for (const s of suggestions) {
    container.appendChild(el("div", { className: "suggestion-item" }, [
      el("a", { href: s.postUrl, target: "_blank", rel: "noopener", textContent: "View post" }),
      el("div", { className: "row" }, [
        el("span", { className: "label", textContent: "Working:" }),
        el("span", { textContent: s.whatsWorking }),
      ]),
      el("div", { className: "row" }, [
        el("span", { className: "label", textContent: "Improve:" }),
        el("span", { textContent: s.whatToImprove }),
      ]),
    ]));
  }
}

async function loadInsights() {
  try {
    const res = await fetch("insights.json", { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function main() {
  const res = await fetch("data.json", { cache: "no-store" });
  const data = await res.json();

  const pageTitle = `@${data.me.handle} — Content Dashboard`;
  document.title = pageTitle;
  document.getElementById("page-title").textContent = pageTitle;

  document.getElementById("fetched-at").textContent = `Data pulled ${new Date(data.fetchedAt).toLocaleString()}`;

  renderStatTiles(document.getElementById("stat-tiles"), data);

  const tt = tooltip();
  renderTopPostsChart(document.getElementById("top-posts-chart"), tt, data);
  renderAccountComparisonChart(
    document.getElementById("account-chart"),
    document.getElementById("account-legend"),
    tt,
    data
  );
  renderTopPostsTable(document.getElementById("top-posts-table"), data);
  renderCompetitorTopPostsTable(document.getElementById("competitor-table"), data);

  const insights = await loadInsights();
  if (insights) {
    if (insights.videoIdeas && insights.videoIdeas.length) {
      document.getElementById("ideas-section").style.display = "";
      document.getElementById("insights-generated-at").textContent =
        `Generated ${new Date(insights.generatedAt).toLocaleString()}`;
      renderVideoIdeas(document.getElementById("idea-grid"), insights.videoIdeas);
    }
    if (insights.postSuggestions && insights.postSuggestions.length) {
      document.getElementById("suggestions-section").style.display = "";
      renderPostSuggestions(document.getElementById("suggestions-list"), insights.postSuggestions);
    }
  }
}

main().catch((err) => {
  console.error(err);
  document.body.appendChild(el("div", { style: "padding: 40px; color: #e34948;", textContent: `Failed to load dashboard data: ${err.message}` }));
});
