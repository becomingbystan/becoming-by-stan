const KEY = "becoming_stan_drafts";

const esc = s => (s || "").replace(/[&<>"']/g, c => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[c]));

function fixImagePath(path) {
  if (!path) return "";

  if (path.startsWith("/images/uploads/")) {
    return "/becoming-by-stan" + path;
  }

  return path;
}

async function getArticles() {
  let articles = [];

  try {
    const r = await fetch(
      "https://api.github.com/repos/becomingbystan/becoming-by-stan/contents/stories"
    );

    if (r.ok) {
      const files = await r.json();

      for (const file of files.filter(f => f.name.endsWith(".md"))) {
        try {
          const raw = await fetch(file.download_url).then(r => r.text());
          const article = parseMarkdownArticle(raw, file.name);

          if (article) {
            articles.push(article);
          }
        } catch {}
      }
    }
  } catch {}

  try {
    articles.push(
      ...JSON.parse(localStorage.getItem(KEY) || "[]")
    );
  } catch {}

  const unique = [];
  const ids = new Set();

  for (const article of articles) {
    if (!ids.has(article.id)) {
      ids.add(article.id);
      unique.push(article);
    }
  }

  unique.sort((a, b) => new Date(b.date) - new Date(a.date));

  return unique;
}

function parseMarkdownArticle(raw, filename) {
  const match = raw.match(/^---\s*([\s\S]*?)\s*---\s*([\s\S]*)$/);

  if (!match) return null;

  const frontmatter = match[1];
  const body = match[2].trim();

  const get = key => {
    const regex = new RegExp(
      "^" + key + "\\s*:\\s*[\"']?(.+?)[\"']?\\s*$",
      "mi"
    );

    const result = frontmatter.match(regex);

    return result ? result[1].trim() : "";
  };

  return {
    id: filename.replace(/\.md$/, ""),
    title: get("title"),
    subtitle: get("subtitle"),
    category: get("category"),
    date: get("date"),
    image: fixImagePath(get("image")),
    excerpt: get("excerpt"),
    body: markdownToHtml(body)
  };
}

function markdownToHtml(text) {
  return text
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\n\n+/g, "</p><p>")
    .replace(/\n/g, "<br>");
}

function card(a) {
  return `
    <a class="story-card" href="article.html?id=${encodeURIComponent(a.id)}">
      <div class="image" ${
        a.image
          ? `style="background-image:url('${esc(a.image)}')"`
          : ""
      }></div>

      <div class="meta">
        ${esc(a.category)} · ${esc(a.date)}
      </div>

      <h2>${esc(a.title)}</h2>

      <p>${esc(a.excerpt)}</p>
    </a>
  `;
}

(async () => {
  const articles = await getArticles();

  const latest = document.querySelector("#latest");

  if (latest) {
    latest.innerHTML = articles.map(card).join("");

    const count = document.querySelector("#count");

    if (count) {
      count.textContent = articles.length + " stories";
    }
  }

  const ct = document.querySelector("#category-title");

  if (ct) {
    const n =
      new URLSearchParams(location.search).get("cat") ||
      "All stories";

    ct.textContent = n;

    const filtered = articles.filter(
      a => n === "All stories" || a.category === n
    );

    document.querySelector("#category-stories").innerHTML =
      filtered.length
        ? filtered.map(card).join("")
        : "<p>No stories yet.</p>";
  }

  const at = document.querySelector("#article-title");

  if (at) {
    const id =
      new URLSearchParams(location.search).get("id");

    const a = articles.find(x => x.id === id);

    if (!a) {
      at.textContent = "Story not found";
      return;
    }

    document.title =
      a.title + " — Becoming, by Stan";

    const category =
      document.querySelector("#article-category");

    const subtitle =
      document.querySelector("#article-subtitle");

    const meta =
      document.querySelector("#article-meta");

    const image =
      document.querySelector("#article-image");

    const body =
      document.querySelector("#article-body");

    if (category) {
      category.textContent = a.category;
    }

    at.textContent = a.title;

    if (subtitle) {
      subtitle.textContent = a.subtitle || "";
    }

    if (meta) {
      meta.textContent = a.date;
    }

    if (a.image && image) {
      image.innerHTML =
        `<img class="article-hero" src="${esc(a.image)}" alt="">`;
    }

    if (body) {
      body.innerHTML = a.body || "";
    }
  }
})();
